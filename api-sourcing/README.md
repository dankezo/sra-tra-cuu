# API Sourcing

Mini-app tại `/api-sourcing/`, giữ HTML/JS thuần + Python như repo.
SQLite (stdlib) dùng riêng, mọi bảng có prefix `apisrc_`; không chạm DB DAV/auth.
Chưa cần Turso/TiDB: GitHub Pages chỉ phục vụ bản dữ liệu công khai đã xuất.

## Kế hoạch và điểm kiểm tra

1. Schema riêng + route + thanh chuyển công cụ. Kiểm tra migration chạy lại được.
2. Tải EDQM TXT, FDA XLSX Type II, WHO CSV; parser + index + tìm kiếm. Kiểm tra dữ liệu thật, trạng thái và ngày nguồn.
3. Thẻ/nguồn/bộ lọc/Bag/checklist/in CEP, quản trị gộp/tách có kiểm soát. Kiểm tra desktop/mobile và snapshot.
4. Đối chiếu dữ liệu DAV hiện có; cổng tra cứu GMP/CPHI, connector FDA có robots/rate limit. Không suy luận nhà máy API từ công ty đăng ký thuốc.
5. Tìm web/trích xuất có nguồn qua API server-side tùy chọn; tự động ghi nhận nguồn bị chặn. Chưa cài browser stealth dependencies.

Mỗi giai đoạn chỉ commit sau khi kiểm tra. Tài liệu này cập nhật với kết quả thực tế.

## Giới hạn dữ liệu

`official_verified` xác nhận bản ghi khớp nguồn chính thức, không xác nhận tồn kho,
GMP hiện tại, chất lượng lô hoặc tư cách bán hàng. DMF không phải phê duyệt FDA.
CEP TSE/Herbal được phân biệt với Chemical. Không tự động gộp fuzzy các pháp nhân.
Checklist DAV là hỗ trợ thu thập hồ sơ, cần pháp chế duyệt; không tự kết luận miễn hồ sơ.

Bag/checklist/quote lưu trên trình duyệt thiết bị này; không có tài khoản hoặc đồng bộ đa thiết bị.
Không gửi email/WhatsApp tự động.
