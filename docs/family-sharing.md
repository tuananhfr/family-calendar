# Gia đình cùng sử dụng

## Luồng sử dụng

1. Gia đình mới vẫn dùng riêng trên IndexedDB, không cần tài khoản. Mở **Cài đặt → Tài khoản và thiết bị** để xác minh email của chủ gia đình.
2. Mở **Cài đặt → Gia đình cùng sử dụng**, chọn thành viên đại diện cho mình, chọn nội dung tệp/ghi âm cần đồng bộ và xác nhận đưa dữ liệu lên máy chủ.
3. Mở **Thành viên → Thêm → Mời qua link/QR hoặc email**. Mặc định lời mời hết hạn sau 48 giờ, dùng được một lượt và cần duyệt.
4. Người nhận mở link, nhập tên và gửi yêu cầu. Họ chưa được tải lịch hay hồ sơ gia đình trước khi được duyệt.
5. Chủ gia đình gắn yêu cầu với một hồ sơ hiện có hoặc tạo hồ sơ mới, chọn vai trò rồi duyệt. Người nhận mở lịch dùng chung.
6. **Quyền gia đình** quản lý vai trò và thu hồi quyền. Không thể xóa/hạ vai trò của chủ gia đình cuối cùng. Đổi hồ sơ đang xem lịch không đổi quyền trên server.

Người nhận không bắt buộc liên kết email để tham gia. Họ nên liên kết email hoặc lưu mã khôi phục trong **Tài khoản và thiết bị** trước khi đổi máy/xóa dữ liệu trình duyệt. Link đăng nhập mới giữ đúng Actor đã chứng minh qua email; không gộp các Actor có cùng tên. Nếu một email gắn nhiều Actor, người dùng chọn danh tính cần mở.

## Danh tính và quyền

- Cookie phiên HttpOnly là thông tin xác thực. IndexedDB chỉ giữ Actor ID, Device ID, Account ID và cờ bật kết nối; không giữ token phiên hay CSRF token.
- Danh tính dùng riêng của thiết bị không bị thay khi đăng nhập. Gia đình local có ID khác được giữ lại; gia đình shared được nhập theo membership hiện tại.
- Liên kết email cần xác nhận trong trình duyệt đang giữ phiên đó. Đăng nhập trên máy mới là luồng riêng, không dùng link liên kết email để chuyển quyền.
- Token đăng nhập và lời mời mới nằm trong URL fragment; frontend xóa fragment sau khi đọc và gửi token trong body POST. Trang xác thực/tham gia dùng no-referrer, noindex. API cũ dùng token trong path còn được giữ để tương thích.
- Backend kiểm tra membership, matrix vai trò, PRIVATE/SENSITIVE và quyền của bản ghi ở từng request. PRIVATE chỉ Actor tạo được đọc, kể cả chủ gia đình.
- Khi client nhận được phản hồi thu hồi membership hoặc Device, client xóa bản sao shared, ảnh/tệp/ghi âm cache và thông báo liên quan. Thiết bị offline chỉ xử lý thu hồi khi kết nối lại. Bản nháp chưa gửi được giữ riêng cùng nội dung media và có thể tải thành zip. Đăng xuất cũng gỡ bản sao shared; dữ liệu local vẫn còn.
- Khi mất mạng/hết phiên, thay đổi chờ gửi được giữ. Khi server từ chối phiên/quyền, engine dừng và hiển thị trạng thái tương ứng.

## Bootstrap và đồng bộ

Bootstrap giữ ID gốc. Journal `bootstrap:<spaceId>` trong IndexedDB lưu ảnh chụp dữ liệu, chunk ID, lựa chọn ban đầu và số chunk đã xác nhận. Lỗi mạng/kích hoạt có thể tiếp tục từ journal; lựa chọn được khóa khi journal còn tồn tại. Sửa/xóa dữ liệu local trong lúc chuyển được đưa vào outbox sau kích hoạt, dựa trên revision của snapshot.

Engine chạy khi người dùng đã bật kết nối, sau thay đổi outbox/mode/lựa chọn media, khi tab hiện lại, khi có mạng và mỗi 60 giây. LOCAL_ONLY không được gửi nội dung gia đình bởi engine. Snapshot mới thay thế projection; sửa chưa gửi đối với bản ghi đã mất quyền được chuyển sang kho bản nháp riêng.

Xung đột không bị ghi đè tự động. Người dùng so sánh hai bản, giữ bản máy chủ hoặc gửi lại bản của mình theo revision mới. Bản bị bỏ lại được lưu trong kho bản nháp trên thiết bị. Không có tác vụ gửi lại sau khi thu hồi quyền.

## Ảnh, tệp và ghi âm

Tệp đính kèm dùng API blob của kho lưu trữ. Avatar và audio dùng `/spaces/:id/media/:kind/:recordId/:assetId`. Media được ràng buộc với bản ghi sở hữu, kiểm tra quyền cả lúc upload/download và mã hóa khi lưu trên server. Tham chiếu một audio PRIVATE từ bản ghi khác không cấp quyền lấy nội dung đó.

Ảnh tối đa 5 MiB, audio tối đa 25 MiB trên API media. Upload kiểm tra MIME, kích thước và SHA-256. Tệp dùng giới hạn cấu hình của API kho. Download không được cache công khai. Thumbnail của ảnh trong kho được tạo trên thiết bị nhận.

Bỏ chọn tệp/audio giữ nội dung chưa gửi trên máy đó. Không xóa nội dung đã gửi trước đây. Trạng thái đồng bộ tính cả media chưa có; nội dung được bỏ chọn có nhãn riêng. Cần sao lưu đồng thời database, thư mục STORAGE_DIR và STORAGE_MASTER_KEY; mất khóa sẽ không giải mã được media. Đây là mã hóa khi lưu, không phải E2EE.

## SMTP production

Cấu hình trong môi trường backend, không đặt thông tin đăng nhập trong frontend:

```ini
MAIL_TRANSPORT=smtp
SMTP_URL=smtps://<user>:<url-encoded-password>@<smtp-host>:465
MAIL_FROM=Lich Gia Dinh <no-reply@your-verified-domain.example>
FRONTEND_ORIGIN=https://lpc.vn
PUBLIC_BASE_PATH=/lich-gia-dinh
COOKIE_SECURE=true
```

Dùng sender/domain đã được nhà cung cấp SMTP xác minh; cấu hình SPF/DKIM/DMARC theo nhà cung cấp. Không dùng sender mặc định .local cho production.

`MAIL_TRANSPORT=file` và SMTP thiếu URL ghi thư vào MAIL_DIR để kiểm thử, không gửi thư thật. UI production khóa thao tác email khi SMTP chưa được cấu hình. Tạo lời mời vẫn có thể trả link/QR nếu email lỗi:
- SENT: SMTP đã chấp nhận người nhận; không phải bảo đảm thư đã vào inbox.
- NOT_CONFIGURED: chưa cấu hình SMTP thật.
- FAILED: lần gửi không được SMTP chấp nhận.

Link đăng nhập/liên kết trả thông báo chung để tránh dò email. Trước khi phát hành, người vận hành cần kiểm tra thư thật, spam/bounce và domain sender. Bộ kiểm thử local không chứng minh khả năng gửi mail ở production.

## Kết quả kiểm chứng local — 2026-10-08

- Backend lint/build: PASS; unit 21 suite / 142 test; integration 20 suite / 140 test.
- Frontend lint/build với base path production: PASS; unit 112 file / 739 test PASS, 1 test SKIP có sẵn.
- TypeScript của E2E: PASS; profile sharing 2 test PASS, gồm luồng nhiều trình duyệt và giao diện danh tính sáng/tối.
- Ảnh chụp thực tế ở các chiều rộng 320/390/768/1024/1440px đã được kiểm tra. Mechanical audit màn đăng nhập: 0 lỗi, 1 cảnh báo khoảng trống desktop; form giới hạn chiều rộng có chủ đích, không có tràn ngang hay ảnh lỗi.
- OpenAPI frontend/backend giống nhau, 65 path. Kiểm tra UTF-8 các file thay đổi không có BOM hay lỗi giải mã; git diff --check PASS.

Đây là kết quả trên môi trường local dùng MariaDB test và email file. Chưa kiểm chứng SMTP/hộp thư thật, chưa chạy trên thiết bị di động vật lý, chưa triển khai production. Khi triển khai vẫn cần migration, cấu hình SMTP và kiểm tra thư thật như hướng dẫn bên dưới.

## Triển khai và kiểm thử

Backend cần build và chạy migration mới `1791301300000-shared-media` trước khi khởi động. Frontend cần build cùng base path backend. Chưa có bước triển khai production tự động trong thay đổi này.

```bash
npm --prefix backend run lint
npm --prefix backend test -- --runInBand
npm --prefix backend run test:int
npm --prefix backend run build
npm --prefix frontend run lint
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix e2e run test:sharing
```

Profile sharing phục vụ bản export ở /lich-gia-dinh trên frontend 3006, API 3007. Trước khi chạy, build frontend với NEXT_PUBLIC_BASE_PATH=/lich-gia-dinh, NEXT_PUBLIC_SITE_ORIGIN=https://lpc.vn và build backend. MariaDB test dùng cổng 3307 và database có hậu tố _test; helper từ chối database khác. Profile không dùng lại server sẵn có và không gửi email thật. Cài dependency bằng npm ci trong mỗi gói; dùng Chrome có sẵn hoặc E2E_CHANNEL theo môi trường.

Kiểm thử luồng nhiều trình duyệt xác nhận: email chủ gia đình, bootstrap, QR, chờ duyệt không tải dữ liệu, gắn hồ sơ, đồng bộ lịch/ảnh, mã khôi phục, đăng nhập khi máy có gia đình local và thu hồi quyền. Responsive kiểm tra 320/390/768/1024/1440px cho màn dùng chung; các trang danh tính kiểm tra cả sáng và tối. Ảnh và trace chứa dữ liệu kiểm thử được giữ trong e2e/test-results, không commit.

OpenAPI backend đã được chép sang frontend và sinh lại type. Hai gói không import mã của nhau. Chỉ tài liệu này và profile sharing cùng helper cần thiết được đưa vào version control; các spec/mockup/QA cũ giữ local.
