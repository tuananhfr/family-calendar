# Đưa Lịch Gia Đình và APK Android lên server

Địa chỉ production hiện tại: `https://lichgiadinh.info`, mã nguồn ở
`/var/www/family-calendar`, MariaDB 3306, frontend 3004, API 3005. Nếu đổi domain hoặc đường dẫn,
sửa đồng thời các file `.env` và nginx trước khi build. Đây là bản để thử trên điện thoại thật;
kiểm thử đã thực hiện trên máy Android ảo, chưa thay thế việc thử trên điện thoại của bạn.

**Domain này chạy ở đường dẫn gốc:** để trống `PUBLIC_BASE_PATH` và `NEXT_PUBLIC_BASE_PATH`;
không thêm `/lich-gia-dinh`. Nếu đang cập nhật từ cấu hình cũ, sửa cả hai giá trị trước khi build.

## Những gì đã chuẩn bị

- Trang công khai `/tai-ung-dung/`, không yêu cầu đăng nhập để tải app hoặc xem hướng dẫn.
- Nút tải APK trên Thời gian màn hình và liên kết Tải app Android ở footer.
- `frontend/public/downloads/lich-gia-dinh-screen-time.apk`: release đã ký, Android 10+, chỉ dùng HTTPS.
- `frontend/public/downloads/android-release.json`: phiên bản, kích thước, SHA-256 và vân tay chứng thư ký công khai.
- Frontend build tự kiểm tra APK và SHA-256; APK có đúng MIME tải Android và được gửi dưới dạng attachment.
- APK không được precache bởi service worker. Người tải app nhận tệp trực tiếp từ server.
- Server không cần Android SDK/JDK/Gradle để phục vụ APK đã đóng gói.
- APK chỉ thu thập/đồng bộ thời gian sử dụng của thiết bị. Lịch và các tiện ích khác vẫn nằm trên website.
- Biểu tượng app sau khi cài dùng logo Lịch Gia Đình. Hình tệp `.apk` trong danh sách tải trên Windows có thể vẫn là biểu tượng tệp chung.

## Trước khi push từ Windows

APK và JSON dưới `frontend/public/downloads/` phải đi cùng mã nguồn trong Git.
Không cần build lại APK khi chỉ thay đổi nội dung website. Khi sửa app Android, tăng `versionCode`
(và `versionName` khi cần) trong `android/app/build.gradle`, sau đó chạy:

```powershell
cd C:\wamp64\www\family-calendar
powershell -ExecutionPolicy Bypass -File scripts/publish-android-apk.ps1
git status --short
```

Khi thay ảnh logo gốc, chạy `node frontend/scripts/generate-android-icons.mjs` trước khi build APK.
Biểu tượng Android dùng chung ảnh gốc đã duyệt của website.

**Sao lưu riêng toàn bộ `%USERPROFILE%\.family-calendar\android-signing\` ở nơi riêng tư an toàn.**
Trên máy hiện tại là `C:\Users\Admin\.family-calendar\android-signing\`. Thư mục chứa khóa ký và
mật khẩu, nằm ngoài repository và thư mục web; không tải lên web, không gửi qua chat. Cần dùng lại đúng khóa
để các lần cập nhật APK sau cài đè được lên bản cũ. Script không tự tạo khóa mới nếu đã có bản phát hành.
Chỉ lần phát hành đầu tiên mới dùng `-InitializeSigningKey` (đã thực hiện trên máy hiện tại).

Bạn tự commit/push toàn bộ thay đổi cần triển khai, gồm APK công khai và file JSON; không push
`backend/.env`, `frontend/.env.local`, `.local/`, `.cache/`, `backend/var/` hoặc dữ liệu kiểm thử.
Các mẫu `.env.production.example` chỉ chứa giá trị mẫu và được đưa vào Git.

## Chuẩn bị server

Nếu server chưa có dự án, database, systemd và nginx, thực hiện phần **Triển khai lên server**
trong [README gốc](../README.md) trước. Nếu đã có bản cũ, giữ nguyên database, tệp lưu trữ và khóa
`STORAGE_MASTER_KEY`; sao lưu database/cấu hình hiện có theo cách bạn đang vận hành.

Sau khi pull mã mới:

```bash
cd /var/www/family-calendar
git pull --ff-only origin main

# Chỉ tạo file cấu hình nếu đây là cài đặt mới. Không ghi đè cấu hình/khóa của bản cũ.
test -f backend/.env || cp backend/.env.production.example backend/.env
test -f frontend/.env.local || cp frontend/.env.production.example frontend/.env.local
nano backend/.env
nano frontend/.env.local
```

Điền thông số thật: DB user/password, domain, `STORAGE_DIR`, khóa lưu trữ hiện có, SMTP URL và địa chỉ
gửi email đã xác minh. Cài đặt mới chưa có dữ liệu mới sinh `STORAGE_MASTER_KEY` bằng
`cd backend && node scripts/gen-keys.mjs`; giữ bản sao an toàn. Không sinh khóa mới cho dữ liệu cũ.
Với SMTP URL, mã hóa URL các ký tự đặc biệt trong username/password. Script kiểm tra cấu hình không
gửi email thử; cần thử thư xác minh thật sau triển khai. `MAIL_TRANSPORT=file` chỉ dành cho local.

Các giá trị bắt buộc chính:

```ini
# backend/.env
NODE_ENV=production
HOST=127.0.0.1
PORT=3005
API_ORIGIN=https://lichgiadinh.info
FRONTEND_ORIGIN=https://lichgiadinh.info
PUBLIC_BASE_PATH=
COOKIE_SECURE=true
RUN_WORKER_IN_PROCESS=false
MAIL_TRANSPORT=smtp

# frontend/.env.local
NEXT_PUBLIC_SITE_ORIGIN=https://lichgiadinh.info
NEXT_PUBLIC_BASE_PATH=
PORT=3004
HOST=127.0.0.1
API_TARGET=http://127.0.0.1:3005
```

Trong nginx, chuyển toàn bộ website ở đường dẫn gốc sang frontend; phần API được frontend proxy vào API 3005.
Ví dụ đặt trong `server` HTTPS của `lichgiadinh.info`, cập nhật block `location /` đang phục vụ ứng dụng:

```nginx
location ^~ / {
    proxy_pass http://127.0.0.1:3004;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    client_max_body_size 210m;
    proxy_read_timeout 300s;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Đảm bảo ba unit systemd `family-calendar-api`, `family-calendar-worker`,
`family-calendar-frontend` đã được cài theo README gốc; frontend dùng `npm start`, không dùng
`npm run dev`. Backend chỉ lắng nghe loopback; không cần mở 3004/3005 ra Internet.

## Build, migration và khởi động

Nạp Node 24 theo cấu hình nvm đang dùng trên server, rồi:

```bash
cd /var/www/family-calendar
node scripts/check-production-config.mjs
bash scripts/deploy-production.sh
```

Script kiểm tra cấu hình và APK, cài npm theo lockfile, build backend/frontend, chạy migration
(gồm bảng screen-time mới), rồi restart ba unit. Cuối cùng kiểm tra HTTPS của API/database,
trang hướng dẫn, MIME tải APK, kích thước và SHA-256. Không tự sửa `.env`, không đổi khóa và không
build lại APK trên server. Không chạy script này trên Windows/Wamp.

Có thể kiểm tra lại sau khi deploy:

```bash
node scripts/check-deployment.mjs https://lichgiadinh.info
sudo systemctl status family-calendar-api family-calendar-worker family-calendar-frontend --no-pager -l
```

Nếu lỗi, đọc log của unit tương ứng và nginx. Không chạy `migration:revert` để sửa lỗi cấu hình;
revert migration screen-time sẽ xóa bảng và dữ liệu của tính năng này.

## Thử trên Android thật

1. Trên trình duyệt của bố mẹ, mở web HTTPS đã triển khai, tạo/chọn gia đình trên server, xác minh
   email và bật chia sẻ gia đình. Dữ liệu/tài khoản ở localhost không tự chuyển sang database server.
2. Trên điện thoại Android 10+, mở `https://lichgiadinh.info/tai-ung-dung/`, tải APK, mở tệp và
   cho phép cài từ trình duyệt/Tệp nếu Android yêu cầu. Đây là app native riêng, không phải PWA.
3. Trên web thật, vào Thời gian màn hình, chọn hồ sơ con, tạo mã mới. Mã local cũ không dùng cho server thật.
4. Trong app, nhập `https://lichgiadinh.info/api/v1` và mã, đọc nội dung chia sẻ, đồng ý liên kết,
   cấp quyền Truy cập dữ liệu sử dụng rồi quay lại. Không cần USB, adb reverse hoặc máy tính luôn bật.
5. Dùng Chrome khoảng 2–3 phút rồi quay lại app; kiểm tra tự đồng bộ và số liệu trên web.
   App tự gửi mỗi phút khi đang mở và theo lịch nền khoảng 15 phút hoặc lâu hơn tùy Android/mạng/pin.
6. Bản release có package khác bản debug USB (`.debug`), nên cần liên kết mới. Tránh để hai bản cùng
   gửi vào cùng hồ sơ khi so sánh tổng giờ; chỉ thu hồi bản kiểm thử không còn dùng.

Sau khi tải bản cập nhật cùng package/chữ ký, cài đè APK để giữ liên kết. Nếu app yêu cầu gỡ bản cũ
do chữ ký khác, kiểm tra khóa ký trước khi xóa dữ liệu của người dùng.
