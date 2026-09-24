# Việt Nam: dữ liệu, bộ lọc và so sánh

## Dữ liệu quốc gia

54.752 hồ sơ DAV từ database BaoAnSearcher, hoàn tất tải 21/09/2026, xuất hiện trong nhóm Việt Nam. Cột công ty dùng `congTyDangKy.tenCongTyDangKy`; nếu trống thì để thiếu, không thay bằng nhà sản xuất. Không gộp các SĐK khác nhau chỉ vì trùng thuốc. Dòng kết quả VN có SĐK và hạn nguồn; Việt Nam được thêm vào bản đồ/danh sách tìm kiếm, không được gắn nhãn nước SRA.

## Một ô bật/tắt

Quy tắc cố định `SraVn.SIMPLE_POLICY`: tân dược thương mại, có hoạt chất, có ngày hết hạn hợp lệ và còn hiệu lực, có **thời hạn được cấp/gia hạn ít nhất 3 năm lịch** tính từ ngày cấp/gia hạn đến ngày hết hạn. Kỳ cấp đúng 3 năm được giữ; không yêu cầu thời gian còn lại phải đủ 3 năm. SĐK thu hồi, bị xóa, không hoạt động, hết hạn hoặc không rõ hạn bị loại. Hồ sơ chỉ có tiếp nhận gia hạn không được tự cộng thêm 5 năm. Ngày gia hạn mới và quyết định bổ sung có nguồn được xử lý trước khi xét hạn.

Giữ tiền tố `VD-`, `VN-`, `VN2-`, `VN3-`, `GC-`; mã 12 số nhóm thứ tư là 1 cũng được giữ. Mã nhóm 6/7 cần SĐK cũ xác nhận tiền tố mục tiêu. Không dùng kiểm tra `V*` vì sẽ loại nhầm VD/VN. [Cấu trúc mã mới](https://dav.gov.vn/images/upload_file/2025/325phu-luc-vsigned_1747811661.pdf).

Tự loại ô khớp [danh mục 93 thuốc, TT03/2024](https://vbpl.vn/boyte/Pages/vbpq-print.aspx?ItemID=166832) theo toàn bộ hoạt chất, đúng hàm lượng từng thành phần và dạng bào chế. Áp dụng như tiêu chí kinh doanh cố định, không còn lựa chọn nhóm dự thầu. Không suy rộng rằng mọi thuốc nhập khẩu cùng hoạt chất bị cấm: danh mục gốc thuộc nhóm 2, có ngoại lệ dạng đặc biệt. Dạng chưa rõ, tên muối chưa quy đổi được về base, hoặc biến thể ngôn ngữ chưa hỗ trợ được giữ để đối chiếu thêm; không gán khớp chắc chắn. Dòng 75 giữ cách ghi `Pcrindopril` của bản HTML nguồn, chưa tự sửa khi chưa đối chiếu bản ký.

Số hồ sơ đạt được tính lại theo ngày dùng công cụ và thời hạn được cấp/gia hạn; loại thêm các ô khớp danh mục 93 trước khi tạo chỉ mục. Đây là số hồ sơ, không phải số đối thủ. Kết quả nước ngoài chỉ cần có ít nhất một thành phần khớp một hồ sơ VN đạt. Kết quả VN khi bật ô phải tự đạt các điều kiện theo chính SĐK đó, không được vượt qua nhờ một SĐK khác cùng hoạt chất.

## So sánh hai bên

Mở từ thanh chọn/xuất kết quả. Bên trái là bản chụp toàn bộ kết quả đang hiển thị theo tìm kiếm, quốc gia và lọc trong thẻ từng nước, kể cả những dòng chưa mở trang. Bên phải chỉ hiện hồ sơ DAV đạt bộ lọc VN có thành phần khớp với phạm vi bên trái. Có thể chọn một dòng, quay lại tất cả, tìm nhanh từng bên, phân trang 40 dòng, sao chép SĐK và xuất Excel. Đóng bằng nút × hoặc Escape sẽ tắt chế độ so sánh.

So khớp bỏ dấu, không phân biệt hoa thường, tách thành phần phối hợp và hàm lượng có đơn vị. Một số biến thể được chuẩn hóa có kiểm soát: acetaminophen/paracetamol, aciclovir/acyclovir, chữ e cuối tên dài, hydrochloride/hydroclorid. Không dùng khoảng cách ký tự tùy ý. “Gần khớp cách viết” và “khớp thành phần” không phải xác nhận tương đương điều trị. Mỗi hồ sơ DAV xuất hiện tối đa một lần dù khớp nhiều kết quả; vẫn ghi các hoạt chất cùng khớp.

Xuất `.xlsx` thực, không đổi đuôi HTML: hai sheet `Kết quả chính` và `DAV đối chiếu`. Xuất toàn bộ phạm vi đối chiếu sau tìm nhanh/lọc, không chỉ 40 dòng trên màn hình. Chọn một dòng trái thì xuất dòng đó và các dòng DAV tương ứng; chọn tất cả thì xuất toàn bộ tập trái. SĐK là chuỗi giữ nguyên số, dữ liệu không trở thành công thức Excel. Cả hai sheet có tiêu đề, bộ lọc và cố định hàng đầu.

## Cập nhật và giới hạn

`_import_vn.py` đọc database nguồn ở chế độ chỉ đọc, dừng nếu còn WAL chưa checkpoint; giữ tên thuốc và công ty đăng ký. `_embed.py` nhúng bảng dữ liệu vào HTML nên trang chạy offline. `data/vn-evidence.json` hỗ trợ quyết định bổ sung đã xác minh theo SĐK, loại quyết định, ngày và URL chính thức; hiện chưa có mục bổ sung. Chưa đồng bộ riêng đầy đủ quyết định gia hạn/thu hồi ngoài DAV; không coi thiếu hạn là bằng chứng giấy phép đã vô hiệu.

Kiểm tra: `test_compare_logic.js` kiểm tra ngưỡng cố định, danh mục, công ty đăng ký, so khớp và loại trùng; `test_vn_policy.js` kiểm tra thuật toán ngày/mã/ngoại lệ; `test_vn_ui.cjs` kiểm tra giao diện, 37 quốc gia, so sánh, lưu/mở lọc, xuất workbook và màn hình nhỏ. Cấu hình cũ `vnPolicy` trong file lọc được bỏ qua; chỉ trạng thái `vnOnly` được phục hồi.
