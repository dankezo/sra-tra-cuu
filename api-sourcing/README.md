# API Sourcing

Mini-app tại `/api-sourcing/`, giữ HTML/JS thuần + Python như repo.
SQLite (stdlib) dùng riêng, mọi bảng có prefix `apisrc_`; không chạm DB DAV/auth.
Chưa cần Turso/TiDB: GitHub Pages chỉ phục vụ bản dữ liệu công khai đã xuất.

## Kế hoạch và điểm kiểm tra

1. Schema riêng + route + thanh chuyển công cụ. Kiểm tra migration chạy lại được.
2. Tải EDQM TXT, FDA XLSX Type II, WHO CSV; parser + index + tìm kiếm. Kiểm tra dữ liệu thật, trạng thái và ngày nguồn.
3. Thẻ/nguồn/bộ lọc/Bag/checklist/in CEP, quản trị gộp/tách có kiểm soát. Kiểm tra desktop/mobile và snapshot.
4. Đối chiếu dữ liệu DAV hiện có; cổng tra cứu GMP/CPHI, connector FDA có robots/rate limit. Không suy luận nhà máy API từ công ty đăng ký thuốc.
5. Tìm web/trích xuất có nguồn qua API server-side tùy chọn; tự động ghi nhận nguồn bị chặn. Đã cài DDGS/Crawl4AI trong venv riêng; không triển khai worker vượt challenge.

Mỗi giai đoạn chỉ commit sau khi kiểm tra. Tài liệu này cập nhật với kết quả thực tế.

## Giới hạn dữ liệu

`official_verified` xác nhận bản ghi khớp nguồn chính thức, không xác nhận tồn kho,
GMP hiện tại, chất lượng lô hoặc tư cách bán hàng. DMF không phải phê duyệt FDA.
CEP TSE/Herbal được phân biệt với Chemical. Không tự động gộp fuzzy các pháp nhân.
Checklist DAV là hỗ trợ thu thập hồ sơ, cần pháp chế duyệt; không tự kết luận miễn hồ sơ.

Bag/checklist/quote lưu trên trình duyệt thiết bị này; không có tài khoản hoặc đồng bộ đa thiết bị.
Không gửi email/WhatsApp tự động.

## Chạy bản đầy đủ trên máy

```powershell
api-sourcing/.venv/Scripts/python.exe api-sourcing/server.py
# http://127.0.0.1:8766/api-sourcing/
```

Chỉ web tĩnh: mở `api-sourcing/index.html`, không cần server hoặc Internet cho tìm hồ sơ.
Server chỉ bind loopback, chỉ phục vụ HTML được cho phép. `.env`, SQLite, mã Python và file thô không được phục vụ.
Không triển khai server này trực tiếp ra Internet: backend công khai cần auth và quản lý quota riêng.
GitHub Pages vẫn phục vụ công cụ SRA/DAV và chỉ mục API Sourcing; tìm web bằng API chỉ hoạt động trên server cục bộ.

Khóa Tavily hiện có được lấy từ tài khoản Google người dùng chỉ định và lưu trong `.env` bị Git bỏ qua.
Các khóa Brave/Exa/Jina/Groq/Google/Firecrawl/SerpApi/HasData người dùng cung cấp cũng chỉ nằm trong `.env`. Không cần khóa để đọc chỉ mục.
`--setup` mở form cấu hình cục bộ dùng token một lần, không hiển thị khóa; không tạo API key mới.
`.env.example` chỉ chứa tên biến. Không đưa các file riêng vào GitHub Pages.

## Nguồn đã tải thật (09/10/2026)

| Nguồn | Bản đã nhập | Ngày file / kỳ | Cập nhật |
|---|---|---|---|
| [EDQM TXT](https://extranet.edqm.eu/4DLink1/4DCGI/EXPORT_WEB_CEP.txt) | 9.508 CEP; giữ cả Chemical/Herbal/TSE | HTTP và nội dung không công bố ngày file: lưu NULL, không đoán | Hằng ngày sau 13:00 CET |
| [FDA DMF](https://www.fda.gov/drugs/drug-master-files-dmfs/list-drug-master-files-dmfs) | 29.162 hồ sơ Type II | Quý II/2026, ngày chốt 30/06/2026 | Theo quý; kiểm tra bản mới hằng tuần khi sang quý |
| [WHO CSV](https://extranet.who.int/prequal/medicines/prequalified/active-pharmaceutical-ingredients/export?page&_format=csv) | 194 WHO PQ APIs | CSV không công bố ngày file: lưu NULL | Hằng tuần |

FDA tải trực tiếp trên kết nối hiện tại bị chặn; đã tải file thật qua trình duyệt từ link trên trang nguồn:
`https://www.fda.gov/media/192069/download?attachment`. Không tự đoán link của các quý tiếp theo.
Một dòng FDA có trạng thái `PASSIGN`; giữ nguyên và gán `unknown`, không biến thành Active.
WHO CSV chứa Applicant, không có site/country: không suy luận nhà máy hay quốc gia từ tên.
EDQM tên holder chứa thành phố/quốc gia: giữ nguyên chuỗi, không suy đoán ranh giới tên công ty/địa chỉ.
CEP Chemical là bộ lọc riêng; không tự coi CEP TSE là chứng minh chất lượng một API hóa dược.

PubChem đang chặn IP tại thời điểm triển khai. `normalize-gsrs` dùng GSRS NCATS để xác minh CAS/UNII/synonyms;
đã chuẩn hóa paracetamol/acetaminophen và amlodipine, lưu URL và thời điểm chuẩn hóa.
CAS của hoạt chất gốc không được tự gán cho các muối khác.
DAV dùng `build_vn.cjs` gọi lại `_vn_logic.js`, chỉ hiển thị SĐK còn hạn trong bản DAV hiện có.
Phải có bằng chứng nguồn API đã duyệt mới được kết luận miễn hồ sơ nguyên liệu.

## Import / cập nhật

```powershell
python api-sourcing/pipeline.py init
python api-sourcing/pipeline.py fetch EDQM
python api-sourcing/pipeline.py fetch WHO
python api-sourcing/pipeline.py import FDA api-sourcing/raw/fda.xlsx --url 'https://www.fda.gov/media/192069/download?attachment' --file-date 2026-06-30 --date-basis quarter_end
python api-sourcing/pipeline.py normalize-gsrs paracetamol
node api-sourcing/build_vn.cjs
python api-sourcing/pipeline.py export
```

`refresh.py` phục hồi DB từ snapshot công khai nếu chạy trên máy/CI mới, chỉ cập nhật nguồn đến hạn,
giữ nguồn cũ nếu tải/parse lỗi. Record biến mất khỏi file đầy đủ mới chuyển `unknown`, không giữ xanh.
`apisrc_ingest_run` lưu số dòng, số thay đổi, lỗi và ngày nguồn. Schema/parser sai thì không phát hành dữ liệu mới.
Workflow `.github/workflows/apisrc-ingest.yml` chạy 12:20 UTC = 13:20 CET / 14:20 CEST, có hiệu lực sau khi vào nhánh mặc định.
Job chỉ commit hai snapshot công khai và gọi workflow Pages. Cần quyền GitHub Actions ghi nội dung/actions.

## Tìm web, reader và crawl

| Connector | Trạng thái / mục đích |
|---|---|
| Tavily | Đã nối tài khoản hiện có, Researcher 1.000 credit/tháng, không thêm thẻ. `ultra-fast`, không tạo AI answer |
| DDGS (`duckduckgo_search` hiện dùng package `ddgs`) | Đã cài 9.16.0; thử backend DuckDuckGo không có kết quả, chưa dùng mặc định |
| Exa | `fast`, đã thử thật: 6 kết quả trong 3.001 ms; fallback khi nguồn ưu tiên lỗi |
| Jina Reader | Đã đọc thử WHO thành công, cache nội dung 30 ngày; ngoài đường tìm kiếm chính |
| Brave | Dùng key do người dùng cung cấp, đã thử thật: 6 kết quả trong 1.249 ms; ưu tiên tìm web |
| Google Custom Search | Đã nối `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX`; request thật trả 403 vì project không có quyền truy cập, chưa bật mặc định |
| Crawl4AI | Đã cài 0.9.4, đọc trang NCC thật thành công; dùng Chrome sẵn trên máy, đóng context sau mỗi tác vụ |
| Firecrawl | Search v2: 6 kết quả trong 3.247 ms; scrape trang NCC: 7.805 ký tự trong 4.428 ms, cache 30 ngày |
| SerpApi | Google organic: thành công trong 5.644 ms; adapter giới hạn 6 kết quả, để tùy chọn vì chậm |
| HasData | Timeout ở mức chờ ngắn; khi tăng timeout trả kết quả trong 4.796 ms, để tùy chọn vì chậm |

Mặc định Brave + Tavily; Exa được gọi khi nguồn trước lỗi và vẫn còn thời gian.
Tối đa hai provider đồng thời cho một truy vấn, trả ngay khi một nguồn có kết quả,
chờ tối đa 3 giây cho cả chuỗi fallback. Provider chậm tiếp tục lưu cache nền. HTTP read timeout riêng 4 giây;
DNS/TLS có thể làm tổng thời gian provider dài hơn, nhưng UI không chờ hết tác vụ đó.
Thay `APISRC_SEARCH_PROVIDERS` để chọn các adapter khác; không gọi tất cả API mỗi lần tìm.
Cache truy vấn trong SQLite 7 ngày, cache cũ trả ngay rồi làm mới; gộp request trùng đang chạy.
Lỗi provider cache 5 phút để tránh gọi lặp nguồn đang lỗi.
Quota cục bộ: Tavily 900, Brave/Exa/SerpApi 100, HasData 20, Firecrawl 25 request/tháng; Google 90/ngày.
Đây là giới hạn request của ứng dụng, không phải số dư credit tài khoản; một request có thể tốn nhiều credit.
Không bao gồm hoạt động của tài khoản trên ứng dụng khác. Kiểm tra dashboard trước khi nâng các giới hạn này.
Không đăng ký trả phí, không bật pay-as-you-go, không thêm thẻ. Provider trả lỗi quota thì báo lỗi, không nâng gói.

```powershell
# Optional engine installation (workspace only, no extra Chromium download)
python -m venv api-sourcing/.venv
api-sourcing/.venv/Scripts/python.exe -m pip install -r api-sourcing/requirements-optional.txt
# Read once then reuse SQLite cache; explicit --refresh is available
api-sourcing/.venv/Scripts/python.exe api-sourcing/reader.py 'https://example.com' --engine crawl4ai
python api-sourcing/reader.py 'https://example.com' --engine jina
python api-sourcing/reader.py 'https://example.com' --engine firecrawl
# Optional extraction, requires configured GROQ_MODEL
python api-sourcing/extract.py amlodipine 'https://supplier.example/product' --engine direct
```

Reader chặn địa chỉ mạng riêng, tôn trọng robots, ghi trạng thái bị chặn thay vì xuất HTML challenge thành dữ liệu.
`fda_access.py` dành riêng cho accessdata.fda.gov: lock xuyên process, cách nhau ≥30 giây, concurrency 1 (≤2),
chặn robots Disallow có wildcard và khác hoa/thường; không theo redirect chưa kiểm tra.
Exa/Tavily search snippets là `unknown`. LLM chỉ nhập listing khi quote khớp nguyên văn và chứa cả công ty + hoạt chất;
listing luôn `supplier_claimed`, không sinh chip chứng chỉ xanh.
Groq model cấu hình đã thử trên trang NCC thật, chấp nhận 0 listing vì chưa đủ bằng chứng khớp;
chưa coi trích xuất Tier 2 tự động là đã hoàn tất hoặc xác minh thành công.
Không tự giải CAPTCHA, ngụy trang fingerprint, lấy clearance cookie hay bỏ qua access denied.
EudraGMDP/CPHI/PharmaSources hiện có link tra cứu; chưa có ingest toàn bộ, chưa tự xác minh GMP/sự kiện.

## Quản trị và kiểm tra

Admin local: `python api-sourcing/admin.py merge <id-cu> <id-dich>` hoặc `split <certificate-id>`.
Giữ holder gốc và alias override qua lần import; chạy export lại để UI cập nhật. Chưa có màn hình admin web.
Phiếu CEP dùng trình duyệt In/Lưu PDF, có số CEP, holder, trạng thái, ngày cấp/nguồn, renewal/end, chuyên luận,
link EDQM, ngày lập phiếu; không gọi là chứng chỉ hoặc xác nhận pháp lý đủ điều kiện nộp.

```powershell
python -m unittest discover -s api-sourcing -p 'test_*.py'
node api-sourcing/test_logic.cjs
node api-sourcing/test_browser.cjs
```

Đã kiểm tra parser/trạng thái/ngày, idempotency, rollback, nguồn sai, cache không gọi mạng,
deadline provider chậm, robots glob, chống LLM bịa quote; E2E tìm → nguồn → Bag → reload, mobile 360/390px.
Tìm chỉ mục sau khi tải/giải nén đo trên Chrome máy hiện tại khoảng 20–217 ms tùy synonyms.
Tavily lần đầu đo 1.624–2.424 ms. Luồng web trong trình duyệt với Brave ưu tiên:
azithromycin mới 1.370 ms backend / 1.419 ms cả UI; amlodipine lặp lại 4 ms backend / 70 ms cả UI.
Đây là phép đo tại máy, không phải cam kết mọi mạng. Tìm CAS từ file HTML tự chứa cũng đã kiểm tra.

## Lưu sẵn để tránh crawl lặp

Đã nhập toàn bộ file công khai EDQM CEP (9.508), FDA DMF Type II (29.162), WHO PQ API (194)
vào SQLite, tổng 38.864 hồ sơ. Chỉ mục xuất ra HTML tự chứa khoảng 3 MB, không gọi API lúc tra cứu.
Tải bulk một lần theo lịch đến hạn: EDQM khoảng 1,5 MB/ngày, WHO khoảng 23 KB/tuần,
FDA XLSX theo quý. Không mở từng trang cho mỗi hồ sơ. Transaction giữ bản cũ khi tải lỗi.
Trang NCC chỉ đọc khi cần rồi cache nội dung 30 ngày; tìm web cache 7 ngày.
CPHI/PharmaSources/EudraGMDP/NMPA chưa có bản dump đã nhập; cần xác minh khả năng export và quyền đọc
trước khi thêm một job có giới hạn trang. Không có bước crawl toàn bộ các website này.

Tham chiếu API: [Brave](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started),
[Firecrawl Search](https://docs.firecrawl.dev/api-reference/endpoint/search),
[SerpApi](https://serpapi.com/search-api), [HasData](https://hasdata.com/apis/google-serp-api).
[Google](https://developers.google.com/custom-search/v1/overview) đóng đăng ký Custom Search mới,
ngừng dịch vụ 01/01/2027; không đặt làm phụ thuộc chính.

Ngoài module chỉ thay `_rebuild.py` (nav), `index.html` (rebuild), `.gitignore`, `.env.example`,
workflow Pages (copy route mới), workflow cập nhật riêng và README gốc. Không sửa logic SRA/DAV.
