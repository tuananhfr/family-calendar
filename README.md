# Lịch Gia Đình

Web giúp gia đình trả lời "Hôm nay nhà mình có gì?": lịch, việc, nhắc, ngày đặc biệt (dương và âm lịch),
thời khóa biểu, thành viên, nhóm, tài chính, sức khỏe, kho lưu trữ, báo cáo, trợ lý AI và SOS.
Dùng được ngay trên thiết bị, không cần tài khoản; chia sẻ và tài khoản là lựa chọn sau.

## Cấu trúc

| Thư mục | Ứng dụng | Cổng dev |
| --- | --- | --- |
| `frontend/` | Next.js (xuất SPA tĩnh) + IndexedDB, chạy offline | 3004 |
| `backend/` | NestJS + TypeORM + MariaDB, API `/api/v1` + worker | 3005 |

Hai thư mục là hai gói npm độc lập: không có `package.json` ở gốc, không workspace, không import chéo.

## Chạy local

Yêu cầu: Node 24.14+, npm 11.11+, MariaDB 11.4 ở `127.0.0.1:3307`.

```bash
cd backend && cp .env.example .env && npm ci && npm run db:create && npm run build && npm run migration:run && npm run start:dev
cd frontend && npm ci && npm run dev        # http://localhost:3004
```

Chi tiết từng app ở README của thư mục đó.

## Triển khai lên server (`https://lichgiadinh.info`)

Hướng dẫn chuẩn bị APK đã ký, nút tải trên web và kiểm tra trước/sau triển khai:
[deployment/README.md](deployment/README.md). APK công khai nằm trong `frontend/public/downloads/`
và được đẩy cùng mã nguồn; server không cần Android Studio. Khóa ký trong `%USERPROFILE%\.family-calendar\android-signing\`
phải sao lưu riêng, không đưa lên Git hoặc web server.

Cùng mô hình với doc-tools: mã ở `/var/www/family-calendar`, Node riêng qua nvm, mỗi tiến trình một
unit systemd, nginx chuyển tiếp nguyên URI. Ba tiến trình:

| Unit systemd | Lệnh | Cổng |
| --- | --- | --- |
| `family-calendar-frontend` | `npm start` trong `frontend/` (phục vụ `out/` + proxy `/api` sang API) | 3004 |
| `family-calendar-api` | `npm start` trong `backend/` | 3005 |
| `family-calendar-worker` | `npm run worker` trong `backend/` (hàng đợi việc nền: gửi nhắc, thông báo, dọn dữ liệu) | — |

Trình duyệt chỉ nói chuyện với nginx → frontend; API không cần mở ra ngoài.

### 1. Mã nguồn và Node

```bash
sudo mkdir -p /var/www/family-calendar && sudo chown "$USER" /var/www/family-calendar
git clone https://github.com/tuananhfr/family-calendar.git /var/www/family-calendar

export NVM_DIR="$HOME/.nvm-family-calendar"
git clone https://github.com/nvm-sh/nvm.git "$NVM_DIR"
source "$NVM_DIR/nvm.sh" --no-use && nvm install 24.21.0 && nvm use 24.21.0
```

Mỗi phiên ssh về sau chạy lại hai dòng `export NVM_DIR=...` / `source ... && nvm use 24.21.0`.

### 2. Cơ sở dữ liệu

MariaDB trên server ở cổng **3306** (khác máy dev; kiểm: `sudo ss -ltnp | grep 330` phải thấy `mariadbd`).
DB dùng chung server với các site khác, nên tạo database và user riêng, chỉ có quyền trên database đó (`sudo mariadb`):

```sql
CREATE DATABASE family_calendar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'family_calendar'@'127.0.0.1' IDENTIFIED BY '<mật khẩu mạnh>';
GRANT ALL PRIVILEGES ON family_calendar.* TO 'family_calendar'@'127.0.0.1';
```

### 3. Cấu hình

`backend/.env` (chép từ `.env.example`, sửa các dòng sau):

```ini
PORT=3005
HOST=127.0.0.1
NODE_ENV=production
API_ORIGIN=https://lichgiadinh.info
FRONTEND_ORIGIN=https://lichgiadinh.info
PUBLIC_BASE_PATH=
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=family_calendar
DB_PASSWORD=<mật khẩu ở bước 2>
DB_NAME=family_calendar
COOKIE_SECURE=true
STORAGE_DIR=/var/www/family-calendar/backend/var/storage
RUN_WORKER_IN_PROCESS=false
```

`STORAGE_MASTER_KEY` sinh bằng `node scripts/gen-keys.mjs`, khóa web push bằng `node scripts/gen-vapid.mjs`.
**Giữ bản sao `STORAGE_MASTER_KEY`**: mất khóa là mất mọi tệp đã lưu. Không đặt `ANTHROPIC_API_KEY` thì trợ lý AI không dùng được.
Mặc định `MAIL_TRANSPORT=file` chỉ ghi thư ra `var/mail`; muốn gửi thật (link đăng nhập, lời mời) thì đặt
`MAIL_TRANSPORT=smtp`, `SMTP_URL` và `MAIL_FROM` thuộc domain đã xác minh. Sender mặc định `.local` chỉ dùng cho local/test.

`frontend/.env.local`:

```ini
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_SITE_ORIGIN=https://lichgiadinh.info
```

`PUBLIC_BASE_PATH` (backend) và `NEXT_PUBLIC_BASE_PATH` (frontend) phải giống nhau. Base path được đóng vào bản
build, nên đổi giá trị là phải build lại frontend.

### 4. Build lần đầu

```bash
cd /var/www/family-calendar/backend && npm ci && npm run build && npm run migration:run
cd /var/www/family-calendar/frontend && npm ci && npm run build
```

### 5. systemd

`/etc/systemd/system/family-calendar-frontend.service` (thay `<user>`):

```ini
[Unit]
Description=Lich Gia Dinh frontend
After=network.target

[Service]
User=<user>
WorkingDirectory=/var/www/family-calendar/frontend
Environment=PORT=3004 HOST=127.0.0.1 API_TARGET=http://127.0.0.1:3005
ExecStart=/bin/bash -c 'export NVM_DIR=/home/<user>/.nvm-family-calendar; source $NVM_DIR/nvm.sh --no-use; nvm use 24.21.0 >/dev/null; exec npm start'
Restart=always

[Install]
WantedBy=multi-user.target
```

`family-calendar-api.service` và `family-calendar-worker.service` giống hệt, đổi `Description`, bỏ dòng
`Environment` (đọc từ `backend/.env`), `WorkingDirectory=/var/www/family-calendar/backend`, và lệnh cuối lần lượt
là `exec npm start` / `exec npm run worker`. Worker thêm `After=family-calendar-api.service`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now family-calendar-api family-calendar-worker family-calendar-frontend
```

### 6. nginx

Trong `server { ... }` HTTPS của `lichgiadinh.info`, chuyển toàn bộ website sang frontend ở đường dẫn gốc:

```nginx
location ^~ / {
    proxy_pass http://127.0.0.1:3004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 210m;   # video tối đa 200 MB
    proxy_read_timeout 300s;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 7. Kiểm tra

```bash
sudo systemctl status family-calendar-frontend family-calendar-api family-calendar-worker --no-pager -l
curl --retry 10 --retry-connrefused --retry-delay 1 -I http://127.0.0.1:3004/
curl -s https://lichgiadinh.info/api/v1/health      # {"status":"ok","db":"ok"}
journalctl -u family-calendar-api -n 80 --no-pager
```

### Cập nhật về sau

```bash
cd /var/www/family-calendar && git pull --ff-only origin main
node scripts/check-production-config.mjs  # kiểm tra HTTPS, DB/SMTP, base path và APK
bash scripts/deploy-production.sh         # build hai app, migration, restart và kiểm tra HTTPS
```

`deploy` gọi `sudo systemctl restart`, nên user chạy lệnh cần quyền sudo cho các unit đó.

### SEO and social previews

Set NEXT_PUBLIC_SITE_ORIGIN to the public HTTPS origin (no path) and NEXT_PUBLIC_BASE_PATH to the deployment prefix before building. These values are baked into canonical URLs, Open Graph, Twitter Cards, JSON-LD and sitemap.xml. Changing either value requires a rebuild.

Only the landing, about, help, terms, privacy, contact and Android download pages are indexed. Other routes emit noindex, follow while keeping generic brand previews. No family data is included in metadata or structured data.

The current production website runs at the domain root (`NEXT_PUBLIC_BASE_PATH=`). Configure the domain's existing `/robots.txt` to allow public pages and include `Sitemap: https://lichgiadinh.info/sitemap.xml`. The sitemap itself is generated by the frontend build.

After deployment, verify the landing and each public canonical URL return 200 over HTTPS, the OG image returns image/png at 1200x630, and sitemap.xml returns application/xml with only the seven public URLs. Test raw HTML with social crawler user agents as well as a browser. Confirm noindex on app, onboarding, invite, SOS, print and UI-kit routes. Social platforms may retain cached previews; request a re-scrape where supported.

### Bộ nhận diện cập nhật 2026-10-31

Logo không vòng tròn dùng ảnh gốc do người dùng cung cấp, lưu tại
`frontend/assets/brand/family-calendar-mark-source-20261031.png`. Chạy
`cd frontend && node scripts/generate-brand-assets.mjs` để xuất lại logo,
favicon, icon PWA và ảnh chia sẻ 1200×630. Favicon đơn giản nằm trong SVG
cùng thư mục brand. URL icon và ảnh chia sẻ có phiên bản mới để tránh cache cũ.
Open Graph, Twitter Cards và JSON-LD dùng chung ảnh mới qua `SHARE_IMAGE_PATH`.
Triển khai lại bản build với origin/base path hiện có; nếu link đã từng chia sẻ
vẫn hiện ảnh cũ, yêu cầu nền tảng chia sẻ tải lại metadata.

## Gia đình cùng sử dụng

Cách mời, duyệt thành viên, quản lý thiết bị/quyền, đồng bộ và yêu cầu SMTP production: [docs/family-sharing.md](docs/family-sharing.md).

## Thời gian màn hình — Android + Web

Màn hình `/thoi-gian-man-hinh/` xem thống kê ngày/7 ngày/30 ngày, thời lượng từng ứng dụng,
mục tiêu phút/ngày, thông báo trong ứng dụng, xuất JSON theo khoảng ngày và xóa toàn bộ dữ liệu.
Giao diện chọn thành viên bằng avatar, thẻ thời gian hôm nay và tiến độ mục tiêu, biểu đồ vòng phân bổ
ứng dụng và biểu đồ cột theo ngày. Phân bổ dựa trên ứng dụng đã thu thập; chưa phân loại học tập/giải trí
và chưa đếm số lần mở khóa. Trang tự lấy lại báo cáo mỗi 15 giây khi đang mở; thao tác này không đánh
thức điện thoại để yêu cầu dữ liệu tức thời.
Có lối vào ở trang Hôm nay, sidebar và menu Gia đình trên điện thoại. Cần bật Gia đình cùng sử dụng
trước khi liên kết Android; web/PWA không tự đọc thời gian sử dụng toàn điện thoại.
Mục Thời gian màn hình nằm trong danh sách chính của sidebar, không cần mở Công cụ nhanh.

### Cài đặt và liên kết

1. Backend: build và chạy migration `1791301400000-screen-time`; build lại frontend với base path hiện có.
2. Build ứng dụng trong `android/` bằng Android Studio hoặc PowerShell từ gốc repo:
   `powershell -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Bootstrap -AcceptSdkLicenses`.
   Lần đầu tải JDK 17, Gradle 8.11.1, CLI 19 và SDK 35 vào `.cache/android`, kiểm tra checksum từ nhà cung cấp.
   `-AcceptSdkLicenses` xác nhận điều khoản SDK; nếu đã có toolchain, mở `android/` bằng Android Studio
   hoặc dùng Gradle 8.11.1 với JDK 17 / SDK 35. Script chạy unit test, Android lint và build APK debug.
3. Cài `android/app/build/outputs/apk/debug/app-debug.apk` lên điện thoại Android 10 trở lên.
   APK debug dành cho kiểm thử; phát hành rộng rãi cần ký bản release bằng khóa được quản lý riêng.
4. Trên web: Thời gian màn hình → chọn thành viên → xác nhận quyền chia sẻ → Tạo mã liên kết.
5. Trên điện thoại: nhập đúng địa chỉ HTTPS kết thúc bằng `/api/v1` hiển thị trên web và mã 12 ký tự,
   đọc nội dung chia sẻ, xác nhận, cấp quyền Truy cập dữ liệu sử dụng, rồi Đồng bộ ngay.
   Ví dụ server: `https://lichgiadinh.info/api/v1`. Bản release yêu cầu HTTPS.

Để kiểm thử bản debug với web local trên Windows, bật Tùy chọn nhà phát triển → Gỡ lỗi USB trên
điện thoại Android, cắm cáp truyền dữ liệu và chấp nhận kết nối từ máy tính. Giữ backend ở cổng 3005
và frontend ở cổng 3004. Từ PowerShell tại gốc dự án, chạy:

```powershell
$adb = '.\.cache\android\sdk\platform-tools\adb.exe'
& $adb devices
& $adb install -r '.\android\app\build\outputs\apk\debug\app-debug.apk'
& $adb reverse tcp:3004 tcp:3005
```

Danh sách phải hiện điện thoại với trạng thái `device`; nếu `unauthorized`, mở khóa điện thoại và
chấp nhận thông báo Gỡ lỗi USB. Mở ứng dụng “Lịch Gia Đình · Thời gian màn hình”, nhập
`http://localhost:3004/api/v1` và mã mới tạo trên web. Đồng ý liên kết, cấp quyền Truy cập dữ liệu
sử dụng, dùng một ứng dụng khác vài phút rồi bấm Đồng bộ ngay. Trở lại web và tải lại thống kê.
Giữ cáp USB khi đồng bộ; sau khi cắm lại, chạy lại lệnh `reverse`. Bản debug chỉ cho HTTP tới
`localhost` hoặc `127.0.0.1`; HTTP tới địa chỉ mạng LAN không được chấp nhận.
Lệnh `reverse` chuyển cổng 3004 của điện thoại trực tiếp tới backend cổng 3005 trên máy tính,
để tránh chuyển hướng thêm dấu `/` của Next.js dev server.

Máy Android ảo cũng dùng được các bước trên. Chờ máy vào màn hình chính trước khi cài APK.
Có thể chạy `powershell -ExecutionPolicy Bypass -File scripts/install-android-debug.ps1` để tự chờ
Android khởi động xong, cài APK, nối cổng local và mở ứng dụng. Nếu có nhiều thiết bị, truyền
`-Serial emulator-5554` (lấy mã từ `adb devices`).

Mã liên kết dùng một lần, hết hạn sau 10 phút. Máy chủ chỉ lưu hash mã/token. Token collector chỉ được
đọc cấu hình, cập nhật trạng thái và upload cho thiết bị đã gắn; không đăng nhập được vào API web.
Chủ gia đình và người giám hộ được gắn với thành viên được xem/đặt mục tiêu; thành viên được xem,
ngừng chia sẻ và xóa dữ liệu của mình. Người lớn không có quan hệ giám hộ không tự được xem trẻ khác.
Đây là quan hệ quyền trong ứng dụng, không phải xác minh quan hệ giám hộ ngoài đời. Không tích hợp PI ID.

### Dữ liệu và giới hạn bản đầu

- Dữ liệu bắt đầu từ lúc đồng ý và cấp quyền; không tự lấy lịch sử trước đó. Thu thập foreground bằng
  UsageEvents; tổng thiết bị dùng hợp các khoảng thời gian để tránh cộng trùng nhiều cửa sổ.
  Thời lượng ứng dụng có thể cộng lớn hơn tổng thiết bị. Nhiều thiết bị được cộng riêng, chưa loại
  thời gian sử dụng đồng thời giữa hai máy. Không suy số lần mở khóa từ số lần mở app.
- Dữ liệu thiếu hiện UNKNOWN/PARTIAL; UNKNOWN trả `total_seconds: null`. Không có số liệu giả mặc định.
  Tên ứng dụng có thể hiện package name khi Android không cung cấp nhãn. Chưa phân nhóm ứng dụng.
- Múi giờ dùng theo gia đình. Thay đổi múi giờ làm collector bắt đầu cửa sổ quan sát mới; dữ liệu cũ
  không tự chuyển ngày và được đánh dấu PARTIAL nếu khác múi giờ hiện tại.
- Android tự đồng bộ khi mở/quay lại ứng dụng và mỗi 60 giây khi ứng dụng đang ở phía trước.
  Khi rời ứng dụng, vòng lặp mỗi phút dừng; JobScheduler tiếp tục lịch nền khoảng 15 phút hoặc lâu
  hơn tùy hệ điều hành. Mở app hoặc dựng lại giao diện không đặt lại lịch nền. Nút Đồng bộ ngay vẫn
  dùng được để thử lại chủ động. Đây không phải luồng thời gian thực và không bảo đảm chạy khi force-stop.
  Dữ liệu và token lưu trong file
  AES-GCM dùng Android Keystore, ghi nguyên tử, không backup. Hàng đợi giữ snapshot mới nhất tối đa
  7 ngày và giữ nguyên batch ID của lần gửi chưa xác nhận; dữ liệu sự kiện được đọc lại trong 3 ngày
  gần nhất. Khoảng trống dài không được coi là dữ liệu đầy đủ. Force-stop/gỡ app có thể ngừng job.
- Thông báo trong ứng dụng tại 80%/100% mục tiêu, tối đa một lần/mốc/ngày; không push, không khóa app.
  Chỉ nhắc khi mọi thiết bị liên kết có dữ liệu COMPLETE, ACTIVE và cập nhật trong một giờ gần nhất.
  Ngày bắt đầu giữa chừng thường là PARTIAL, nên chưa nhắc. Tắt mục tiêu nhắc không dừng thu thập.
- Thu hồi trên web chặn token ngay ở request sau; điện thoại offline nhận biết khi kết nối lại.
  Ngừng chia sẻ trên điện thoại xóa token/hàng đợi trước khi gọi server; nếu mất mạng cần gỡ liên kết
  trên web để xác nhận thu hồi phía server. Dữ liệu cũ vẫn tồn tại đến khi chọn Xóa dữ liệu.
- API chỉ nhận dữ liệu trong 90 ngày gần nhất và dọn dữ liệu cũ của thiết bị khi upload. Chưa có
  tác vụ xóa định kỳ cho thiết bị ngừng hoạt động; không coi đây là cam kết retention tự động 90 ngày.
  Xóa dữ liệu hủy liên kết, xóa thống kê/mục tiêu/thông báo; audit tối thiểu không chứa tên ứng dụng
  được giữ. Bản sao lưu server tuân theo chính sách vận hành, không nằm trong thao tác xóa trực tiếp.
- Chưa hỗ trợ collector iOS, thiết bị dùng chung nhiều người, phân loại học tập/giải trí, phê duyệt
  mục tiêu, xác minh người giám hộ hay đồng bộ thời gian thực. Cần kiểm tra trên điện thoại thật
  trước khi cam kết hỗ trợ một mẫu máy. Không coi build hoặc unit test là bằng chứng đo đúng trên máy thật.

### API và kiểm thử

OpenAPI nằm ở `backend/openapi.json`, bản sao ở `frontend/src/core/api/openapi.json`. Web dùng cookie/CSRF
hiện có; `/api/v1/screen-time/collector/*` dùng Bearer token riêng. Endpoint web nằm dưới
`/api/v1/spaces/{spaceId}/screen-time`: danh sách `members`, `members/{memberId}/summary`, `pairings`,
`goal`, `devices/{deviceId}`, `export`, `data`. Summary/export yêu cầu `from`, `to`, tối đa 31 ngày.
Collector có `POST link`, `GET config`, `PUT state`, `POST batches`, `DELETE link`.

Kiểm tra bằng `npm --prefix backend test -- --runInBand`,
`npm --prefix backend run test:int`, `npm --prefix frontend test`, và
`npm --prefix e2e run test:screen-time` sau khi build frontend với base path
`/lich-gia-dinh`. Để kiểm thử bản production hiện tại ở đường dẫn gốc, đặt
`E2E_SCREEN_TIME_BASE_PATH=/` trước khi chạy lệnh test (PowerShell: `$env:E2E_SCREEN_TIME_BASE_PATH = '/'`).
Test trình duyệt dùng API fixture cho các trạng thái và form; integration test
kiểm API thật với MariaDB `_test`. Script Android chạy 6 test thuật toán và 4 test địa chỉ máy chủ,
kiểm tra lint và tạo APK. Thêm 3 test kiểm tra định dạng mã liên kết và ký tự dễ nhầm.

Migration mới bổ sung bảng, không thay dữ liệu lịch hiện có. Khi cần khôi phục phiên bản cũ:
dừng collector/API mới, khôi phục bản frontend/backend trước và giữ bảng screen-time để không mất dữ liệu.
`npm run migration:revert` chỉ dùng khi chủ động muốn xóa toàn bộ bảng screen-time mới (mất dữ liệu tính năng).

Kiểm chứng local ngày 03/11/2026: frontend/backend build và lint đạt; backend unit 146 test đạt;
frontend unit 788 test đạt, 1 test được bỏ qua sẵn; screen-time integration 14 test đạt;
browser profile mới đạt ở 320/390/1440px, gồm giao diện tối và 403 sau thu hồi; Android 6 test thuật toán,
lint không có lỗi và APK debug build đạt. Bộ integration tổng có 155 test đạt và 1 ca hiệu năng
timeout ở bước chuẩn bị; chạy riêng ca đó với thời gian chuẩn bị tối đa 120 giây đạt và vẫn giữ
ngưỡng p95 1 giây. Typecheck profile screen-time đạt; typecheck toàn bộ E2E cũ còn thiếu các helper
`emergency`, `pwa`, `items-occurrence` ngoài phạm vi thay đổi này. Chưa cài/đối chiếu số liệu trên
điện thoại vật lý và chưa triển khai lên server production.

Bổ sung kiểm chứng giao diện và tự đồng bộ: Android 13 unit test đạt, lint không có lỗi; APK mới
đã cài lên máy ảo đang liên kết. Mở Chrome rồi quay lại app tự gửi dữ liệu lên MariaDB mà không
bấm Đồng bộ ngay; để app ở phía trước tiếp tục cập nhật mỗi phút. Job nền gửi thành công khi
chạy thử bằng `adb shell cmd jobscheduler run -f vn.lichgiadinh.screentime.debug 4109`; đây là
kiểm tra đường chạy job, không phải cam kết Android luôn chạy đúng phút thứ 15.
Frontend build/typecheck đạt; browser test kiểm tra giao diện 320/390/1440px, mục tiêu tăng/giảm,
liên kết điện thoại và tự gỡ báo cáo sau khi quyền xem bị thu hồi. Liên kết thiết bị đã có được giữ
khi cập nhật APK bằng `adb install -r`.
