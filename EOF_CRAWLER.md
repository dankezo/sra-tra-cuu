# Crawl thuốc EOF

Python 3.10 trở lên. Chạy trong thư mục dự án:

```powershell
python -m pip install -r requirements-eof.txt
python crawl_eof.py --workers 6
```

Mặc định lưu tại `data/raw/GR/crawl/`:

- `eof_stage1.csv`: danh sách có trạng thái Approved (mã trường tìm kiếm `E`).
- `stage1_status.json`: tổng đã quét, số dòng xuất, dấu hoàn thành và SHA-256 CSV.
- `pages/`: dữ liệu từng trang đã nhận, ghi thay thế nguyên tử.
- `details.sqlite3`: checkpoint từng thuốc, commit sau mỗi kết quả.
- `EOF_Greek_Medicines_Full.xlsx`: danh sách hợp nhất, kèm trạng thái/lỗi chi tiết.

## Thử ít dữ liệu

```powershell
python crawl_eof.py --phase 1 --limit 100 --output-dir data/raw/GR/crawl_test
python crawl_eof.py --phase 2 --limit 5 --output-dir data/raw/GR/crawl_test
```

`--limit` pha 1 giới hạn số dòng bảng quét, trước khi lọc Approved; pha 2 giới hạn số thuốc đọc từ CSV. Không dùng thư mục test làm dữ liệu toàn bộ. Không cố định tổng số thuốc trong mã.

## Chạy lại sau gián đoạn

```powershell
python crawl_eof.py --phase 1
python crawl_eof.py --phase 2 --workers 6
```

Pha 1 mở phiên mới rồi quét lại từ đầu để không trộn thứ tự của hai snapshot. CSV được lưu sau từng trang; trang lỗi không bị bỏ qua. Chỉ có `complete: true` khi quét tới tổng số dòng EOF báo. File CSV tồn tại không được coi là đã hoàn tất.

Pha 2 bỏ qua thuốc có checkpoint `ok`, thử lại thuốc `partial`/`error`. Dùng mã EOF làm khóa vì URL chi tiết có token thay đổi. Muốn cập nhật lại cả các chi tiết đã thành công, dùng thư mục đầu ra mới. Excel được xuất khi pha 2 kết thúc; nếu bị ngắt trước đó, kết quả vẫn nằm trong SQLite và được dùng khi chạy lại.

## Các điểm đã kiểm tra với EOF

- GET ban đầu chưa có kết quả. Cần submit `frmSearch:btnSearch` trước khi phân trang.
- POST tìm kiếm đặt `frmSearch:txtDrstatus_input=E`. Trong lần thử, máy chủ vẫn trả cả trạng thái khác; script kiểm tra trạng thái từng dòng trước khi xuất.
- Mỗi POST JSF lấy ViewState mới từ XML, không dùng regex để cắt CDATA.
- **Token link chi tiết có thể mất hiệu lực sau khi chuyển trang**, kể cả còn cookie. Vì vậy pha 2 đọc danh sách từ CSV, làm mới link từng trang, xử lý tối đa 10 worker và đợi xong cả nhóm trước khi chuyển trang tiếp theo. GET trực tiếp tất cả link cũ từ CSV không đáng tin cậy.
- Mỗi worker tự mở phiên, tìm kiếm với `E` và làm mới link của trang tương ứng. Không chia sẻ cookie giữa worker: EOF có thể trả chéo chi tiết nếu nhiều request cùng phiên. Script đối chiếu mã thuốc trong tiêu đề trang trước khi nhận kết quả.
- Trang chi tiết bị chuyển thành trang tìm kiếm được ghi lỗi, không lấy nhãn bộ lọc làm hoạt chất/công ty.
- Chỉ đọc tên hoạt chất trong phần tương ứng, không trộn với liều, địa chỉ MAH hay mô tả ATC.
- Có timeout, retry GET, khởi tạo lại JSF khi lỗi, chống lặp mã ở pha 1. Không tắt xác minh TLS.

Mã thoát `0`: các bước yêu cầu xong, chi tiết đầy đủ. Mã `2`: đã xuất Excel nhưng có chi tiết thiếu/lỗi, xem `Detail_Status` và `Detail_Error`. Lỗi danh sách làm script dừng, không đánh dấu hoàn tất. Không tự cập nhật ứng dụng tra cứu hay push Git.

Kiểm tra:

```powershell
python -m unittest test_crawl_eof.py
```
