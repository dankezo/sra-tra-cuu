# Rule filter “Hoạt chất ở VN” — dùng lại cho tool khác

Mục đích: từ kết quả thuốc đang tra, giữ các thuốc có ít nhất một thành phần xuất hiện trong tập SĐK DAV đạt tiêu chí sàng lọc kinh doanh. Không chỉ kiểm tra tên hoạt chất có tồn tại trong DAV; phải kiểm tra chất lượng hồ sơ đối chiếu trước.

## 1. Dựng tập hồ sơ DAV đạt điều kiện

Ngày xét là ngày hiện tại tại máy chạy công cụ. Mỗi SĐK được xét riêng.

| Điều kiện | Cách xử lý hiện tại | Mục đích |
|---|---|---|
| Thu hồi, bị xóa hoặc không có cờ hoạt động | Loại | Không dùng hồ sơ này làm bằng chứng hoạt chất đạt điều kiện |
| Không thuộc tân dược thương mại mục tiêu | Loại | Bám phạm vi kinh doanh đã chọn |
| Thiếu ngày hết hạn hợp lệ hoặc trạng thái hạn không rõ | Loại khỏi tập đạt | Không suy đoán hiệu lực khi thiếu dữ liệu |
| Hết hạn trước ngày xét, hoặc có cờ hết hạn chưa được quyết định gia hạn hợp lệ thay thế | Loại | Chỉ dùng hồ sơ còn hiệu lực theo dữ liệu |
| Thiếu ngày bắt đầu kỳ cấp/gia hạn hợp lệ; ngày bắt đầu ở tương lai hoặc sau ngày hết hạn | Loại | Không đủ căn cứ tính thời hạn được cấp |
| Thời hạn được cấp/gia hạn dưới 3 năm lịch | Loại; đúng 3 năm được giữ | Ngưỡng sàng lọc kỳ cấp theo lựa chọn của người dùng |
| Thiếu hoạt chất có thể chuẩn hóa | Loại | Không thể dùng để so khớp |
| Khớp chắc chắn một ô trong danh mục 93 nội địa | Loại | Loại các ô kỹ thuật thuộc phạm vi kinh doanh cần tránh |

**Ngày bắt đầu:** ưu tiên ngày gia hạn hợp lệ; nếu không có, lấy ngày cấp hợp lệ. Điều kiện thời gian là:

```text
ngày_hết_hạn >= ngày_xét
ngày_bắt_đầu <= ngày_xét
ngày_hết_hạn >= cộng_36_tháng_lịch(ngày_bắt_đầu)
```

Không yêu cầu còn đủ 3 năm tính từ hôm nay. Ví dụ kỳ cấp 24/07/2024–24/07/2029 là 5 năm và qua điều kiện thời gian khi xét ngày 24/09/2026, dù chỉ còn 2 năm 10 tháng. Hết hạn đúng ngày xét vẫn qua điều kiện ngày.

**Mã SĐK mục tiêu trong code:** mã cũ bắt đầu `VD-`, `VN-`, `VN2-`, `VN3-`, `GC-` rồi đến chữ số. Với mã mới gồm 12 chữ số: nhận khi chữ số thứ tư là `1`; nếu là `6` hoặc `7`, chỉ nhận khi mã SĐK cũ thuộc các tiền tố trên. Đây là quy tắc nhận dạng đang triển khai, không lấy mọi mã bắt đầu bằng chữ V.

**Gia hạn:** chỉ áp dụng hạn mới từ quyết định bổ sung có ngày ban hành không sau ngày xét, SĐK tương ứng và nguồn chính thức trong dữ liệu. Giấy tiếp nhận hồ sơ gia hạn không tự tạo hạn mới. Hồ sơ đã hết hạn/không rõ hạn nhưng có giấy tiếp nhận được gắn “cần xác minh gia hạn”, không vào tập đạt. Hiện chưa có bộ quyết định bổ sung được đồng bộ đầy đủ; snapshot DAV đang dùng là ngày 21/09/2026.

## 2. Cách loại theo danh mục 93

Chỉ tự loại khi đồng thời khớp:

- Toàn bộ tập hoạt chất của thuốc, không chỉ một thành phần.
- Hàm lượng gắn đúng từng hoạt chất; quy đổi đơn vị khối lượng khi phân tích chắc chắn được.
- Dạng bào chế thuộc loại tương ứng mà bộ nhận dạng hỗ trợ.

Code dùng các dòng nhóm `2` của danh mục đã nhập như một điều kiện sàng lọc cố định. Không có lựa chọn nhóm thầu trong giao diện. Đây không phải phép kết luận cấm nhập khẩu/cấm thầu trên mọi nhóm.

Trường hợp khác muối/base, dạng đặc biệt, thiếu thông tin hoặc không phân tích chắc chắn được hàm lượng/dạng: gắn cần kiểm tra, không tự loại theo danh mục 93. Các điều kiện hồ sơ ở mục 1 vẫn áp dụng.

## 3. Cách khớp với kết quả tìm kiếm

Tạo tập khóa hoạt chất từ hồ sơ DAV đã qua mục 1 và 2. Chuẩn hóa từng thành phần:

- Chuyển chữ thường, bỏ dấu, đổi đ thành d.
- Bỏ phần trong ngoặc và các số hàm lượng kèm đơn vị.
- Tách thành phần phối hợp theo dấu phân cách như `+`, `;`, `/`, dấu phẩy, xuống dòng và các từ nối được hỗ trợ.
- Chuẩn hóa một số biến thể có kiểm soát: acetaminophen → paracetamol; aciclovir → acyclovir; sodium → natri; các cách viết hydrochloride/hydroclorid/HCl và dihydrochloride.
- Hiện có quy tắc bỏ chữ e cuối từ dài từ 7 ký tự, ví dụ paracetamole → paracetamol. Khi dùng lại cần giữ rõ giới hạn này: đây là heuristic cách viết, không phải suy luận tương đương hóa học.

Giữ kết quả nếu **ít nhất một thành phần** có khóa trùng tập DAV đạt. Có xét tên hoạt chất từ các nguồn gốc đi kèm bản ghi. Không so tên thuốc/công ty để thay thế hoạt chất; không dùng khoảng cách ký tự tùy ý hoặc khớp chuỗi con bất kỳ.

Ví dụ: DAV đạt có paracetamol thì thuốc phối hợp `paracetamóle 5mg / abcxyg 6mg` qua bước khớp hoạt chất. Bước này không yêu cầu hàm lượng và dạng giống nhau. Sau đó, nếu chính kết quả khớp chắc chắn ô danh mục 93 thì vẫn bị loại.

**Riêng dòng kết quả Việt Nam:** SĐK của chính dòng đó phải đạt mục 1 và 2; không được giữ một SĐK hết hạn chỉ vì có SĐK khác cùng hoạt chất còn hiệu lực.

## 4. Luồng triển khai gợi ý

```text
DAV_đạt = DAV xét từng SĐK theo điều kiện hồ sơ, kỳ cấp và danh mục 93
khóa_VN = tập hợp khóa của từng thành phần từ DAV_đạt

với mỗi kết quả đang tìm:
    nếu là dòng VN và chính SĐK không thuộc DAV_đạt: loại
    nếu không có thành phần nào khớp khóa_VN: loại
    nếu khớp chắc chắn ô hoạt chất + hàm lượng + dạng trong danh mục 93: loại
    còn lại: giữ
```

Cache tập khóa theo phiên bản dữ liệu và ngày xét; chỉ so trên tập kết quả tìm kiếm hiện tại. Bỏ tick VN thì bỏ các điều kiện VN và giữ các bộ lọc tìm kiếm khác.

## 5. Phân biệt với bộ lọc bổ sung trong bảng so sánh

Các ô số lượng cạnh Xuất Excel không thuộc checkbox VN cơ bản. Chúng chỉ lọc bên DAV trong bảng so sánh:

- Số SĐK riêng biệt ≤ x.
- Số dạng bào chế riêng biệt = x.
- Số hàm lượng riêng biệt = x.

Đếm theo từng hoạt chất trên toàn bộ DAV đạt, không đếm lại sau khi thu hẹp tìm kiếm. Các điều kiện đã bật phải cùng đạt trên một hoạt chất đang khớp. Thiếu dạng/hàm lượng thì không đạt điều kiện đếm tương ứng. Không đồng nhất số SĐK với số doanh nghiệp đối thủ.

Nguồn triển khai để đối chiếu: `_vn_logic.js`, `SIMPLE_POLICY`, `_app.js` và `_compare.js`. Toàn bộ rule trên mô tả hành vi hiện tại của ứng dụng, không xác nhận tương đương điều trị giữa các thuốc.
