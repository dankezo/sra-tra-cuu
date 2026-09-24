# Việt Nam: dữ liệu, bộ lọc và so sánh

## Dữ liệu quốc gia

54.752 hồ sơ DAV từ database BaoAnSearcher, hoàn tất tải 21/09/2026, xuất hiện trong nhóm Việt Nam. Cột công ty dùng `congTyDangKy.tenCongTyDangKy`; nếu trống thì để thiếu, không thay bằng nhà sản xuất. Không gộp các SĐK khác nhau chỉ vì trùng thuốc. Dòng kết quả VN có SĐK và hạn nguồn; Việt Nam được thêm vào bản đồ/danh sách tìm kiếm, không được gắn nhãn nước SRA.

## Lọc theo trạng thái (4 tag)

Dropdown **Lọc theo trạng thái** thay checkbox cũ. Mặc định chỉ **TAG_XANH_LA** (Sẵn sàng dự thầu): tân dược thương mại, có hoạt chất, hạn hợp lệ còn hiệu lực, kỳ cấp/gia hạn **> 3 năm lịch**, còn hạn **> 18 tháng**, không khớp Danh mục 93. Kỳ cấp đúng ≤ 3 năm hoặc còn hạn ≤ 18 tháng → **TAG_VANG_XAC_MINH**. Khớp DM93 → **TAG_CAM_CMO**. Hết hạn / thu hồi / thiếu dữ liệu → **TAG_XAM_LICH_SU**.

Quy tắc ngày/mã vẫn theo `SraVn.SIMPLE_POLICY` (months:18, excludeShort). Hồ sơ chỉ có tiếp nhận gia hạn không được tự cộng thêm 5 năm. Ngày gia hạn mới và quyết định bổ sung có nguồn được xử lý trước khi xét hạn.

Giữ tiền tố `VD-`, `VN-`, `VN2-`, `VN3-`, `GC-`; mã 12 số nhóm thứ tư là 1 cũng được giữ. Mã nhóm 6/7 cần SĐK cũ xác nhận tiền tố mục tiêu. Không dùng kiểm tra `V*` vì sẽ loại nhầm VD/VN. [Cấu trúc mã mới](https://dav.gov.vn/images/upload_file/2025/325phu-luc-vsigned_1747811661.pdf).

Tự loại ô khớp [danh mục 93 thuốc, TT03/2024](https://vbpl.vn/boyte/Pages/vbpq-print.aspx?ItemID=166832) theo toàn bộ hoạt chất, đúng hàm lượng từng thành phần và dạng bào chế. Áp dụng như tiêu chí kinh doanh cố định, không còn lựa chọn nhóm dự thầu. Không suy rộng rằng mọi thuốc nhập khẩu cùng hoạt chất bị cấm: danh mục gốc thuộc nhóm 2, có ngoại lệ dạng đặc biệt. Dạng chưa rõ, tên muối chưa quy đổi được về base, hoặc biến thể ngôn ngữ chưa hỗ trợ được giữ để đối chiếu thêm; không gán khớp chắc chắn. Dòng 75 giữ cách ghi `Pcrindopril` của bản HTML nguồn, chưa tự sửa khi chưa đối chiếu bản ký.

Số hồ sơ đạt được tính lại theo ngày dùng công cụ và thời hạn được cấp/gia hạn; loại thêm các ô khớp danh mục 93 trước khi tạo chỉ mục. Đây là số hồ sơ, không phải số đối thủ. Kết quả nước ngoài chỉ cần có ít nhất một thành phần khớp một hồ sơ VN đạt. Kết quả VN khi bật ô phải tự đạt các điều kiện theo chính SĐK đó, không được vượt qua nhờ một SĐK khác cùng hoạt chất.

## So sánh hai bên

Mở từ thanh chọn/xuất kết quả. Bên trái là bản chụp toàn bộ kết quả đang hiển thị theo tìm kiếm, quốc gia và lọc trong thẻ từng nước, kể cả những dòng chưa mở trang. Bên phải chỉ hiện hồ sơ DAV có `tagId` nằm trong các tag đang chọn ở dropdown ngoài, và thành phần khớp với phạm vi bên trái. Có thể chọn một dòng, quay lại tất cả, tìm nhanh từng bên, phân trang 40 dòng, sao chép SĐK và xuất Excel. Đóng bằng nút × hoặc Escape sẽ tắt chế độ so sánh.

So khớp bỏ dấu, không phân biệt hoa thường, tách thành phần phối hợp và hàm lượng có đơn vị. Một số biến thể được chuẩn hóa có kiểm soát: acetaminophen/paracetamol, aciclovir/acyclovir, chữ e cuối tên dài, hydrochloride/hydroclorid. Không dùng khoảng cách ký tự tùy ý. “Gần khớp cách viết” và “khớp thành phần” không phải xác nhận tương đương điều trị. Mỗi hồ sơ DAV xuất hiện tối đa một lần dù khớp nhiều kết quả; vẫn ghi các hoạt chất cùng khớp.

Xuất `.xlsx` thực, không đổi đuôi HTML: hai sheet `Kết quả chính` và `DAV đối chiếu`. Xuất toàn bộ phạm vi đối chiếu sau tìm nhanh/lọc, không chỉ 40 dòng trên màn hình. Chọn một dòng trái thì xuất dòng đó và các dòng DAV tương ứng; chọn tất cả thì xuất toàn bộ tập trái. SĐK là chuỗi giữ nguyên số, dữ liệu không trở thành công thức Excel. Cả hai sheet có tiêu đề, bộ lọc và cố định hàng đầu.

Bấm thẻ DAV bên phải lọc tập trái theo ít nhất một thành phần tương ứng; tập ứng viên DAV vẫn giữ để có thể chọn thẻ khác. Nút Đối chiếu tất cả bỏ lựa chọn thẻ ở cả hai bên. Mỗi bên có dropdown dạng bào chế và hàm lượng riêng. Excel tuân theo các bộ lọc và lựa chọn đang hiển thị.

Các ô bật/tắt cạnh Xuất Excel áp dụng cho DAV: số SĐK không quá x; số dạng đúng x; số hàm lượng đúng x. Thống kê theo từng khóa hoạt chất chuẩn hóa trên toàn bộ DAV đạt điều kiện, không đếm lại sau khi tìm nhanh/chọn thẻ. Đếm SĐK riêng biệt; dạng chuẩn hóa dấu/chữ hoa/khoảng trắng, hàm lượng dùng `strengthKey` (mg/g/mcg cho đơn chất). Không suy đoán tương đương dạng khác tên. Nếu thiếu dạng/hàm lượng thì không đạt điều kiện số lượng tương ứng. Tất cả điều kiện đã bật phải cùng đạt trên ít nhất một hoạt chất đang khớp.

## Hiệu năng

Kết quả vẫn nằm trong HTML chạy offline. Tra loại từ khóa/gợi ý được cache theo từ khóa, không quét toàn bộ gợi ý trên mỗi dòng thuốc. Lọc chính, lọc trong thẻ và so sánh chia đợt, nhường luồng giao diện và hiển thị tiến độ; yêu cầu mới hủy kết quả cũ. Cache khóa thành phần, thông tin mỗi dòng và thống kê DAV giữa các lần mở. Nạp dữ liệu/lập chỉ mục chia giai đoạn có tiến độ; đọc JSON và một số bước gộp/sắp xếp vẫn đồng bộ.

Mặc định 50 dòng/lượt, chọn được 25/50/100/200. Lựa chọn cũ “hết” hoặc ngoài phạm vi chuyển về 50; mở thẻ và Hiện thêm có báo đang hiển thị; không ảnh hưởng số đếm/chọn hết/xuất toàn bộ. So sánh dựng tối đa 40 thẻ mỗi bên. Đây là giảm tải trên trình duyệt, chưa thêm máy chủ cơ sở dữ liệu.

## Cập nhật và giới hạn

`_import_vn.py` đọc database nguồn ở chế độ chỉ đọc, dừng nếu còn WAL chưa checkpoint; giữ tên thuốc và công ty đăng ký. `_embed.py` nhúng bảng dữ liệu vào HTML nên trang chạy offline. `data/vn-evidence.json` hỗ trợ quyết định bổ sung đã xác minh theo SĐK, loại quyết định, ngày và URL chính thức; hiện chưa có mục bổ sung. Chưa đồng bộ riêng đầy đủ quyết định gia hạn/thu hồi ngoài DAV; không coi thiếu hạn là bằng chứng giấy phép đã vô hiệu.

Kiểm tra: `test_compare_logic.js` kiểm tra ngưỡng cố định, danh mục, công ty đăng ký, so khớp, tagId và loại trùng; `test_vn_policy.js` kiểm tra thuật toán ngày/mã/ngoại lệ; `test_vn_ui.cjs` kiểm tra dropdown tag, so sánh theo tag đã chọn, lưu/mở `vnTags`, xuất workbook và màn hình nhỏ. Cấu hình cũ `vnOnly` trong file lọc được map sang xanh (true) hoặc không chọn (false); ưu tiên `vnTags` nếu có.

`test_compare_filters.cjs` kiểm tra số lượng, giá trị thiếu, phối hợp cùng hoạt chất, lọc hai chiều, dropdown và Excel. `test_large_search.cjs` đo trên dữ liệu đầy đủ, giới hạn DOM, phân trang và đóng tác vụ đang nạp.

Các bộ lọc số lượng trong bảng so sánh gom checkbox, tên và mức chọn vào cùng ô; có viền hover/focus và nền khi bật. SĐK tối đa: 1/2/3/4/5/Khác; số dạng: 1–7/Khác; mức hàm lượng: 1/3/4/5/Khác. Chỉ chọn Khác mới hiện ô nhập số nguyên dương. Đổi mức không tự bật checkbox. Cách đếm và điều kiện so sánh giữ nguyên.
