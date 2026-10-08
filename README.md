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

## Triển khai lên server (`https://lpc.vn/lich-gia-dinh`)

Cùng mô hình với doc-tools: mã ở `/var/www/family-calendar`, Node riêng qua nvm, mỗi tiến trình một
unit systemd, nginx chuyển tiếp nguyên URI. Ba tiến trình:

| Unit systemd | Lệnh | Cổng |
| --- | --- | --- |
| `family-calendar-frontend` | `npm start` trong `frontend/` (phục vụ `out/` + proxy `/lich-gia-dinh/api` sang API) | 3004 |
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
API_ORIGIN=https://lpc.vn
FRONTEND_ORIGIN=https://lpc.vn
PUBLIC_BASE_PATH=/lich-gia-dinh
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
NEXT_PUBLIC_BASE_PATH=/lich-gia-dinh
NEXT_PUBLIC_SITE_ORIGIN=https://lpc.vn
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

Trong `server { ... }` của `lpc.vn`. `proxy_pass` **không** có `/` ở cuối để giữ nguyên URI `/lich-gia-dinh/...`:

```nginx
location /lich-gia-dinh {
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
curl --retry 10 --retry-connrefused --retry-delay 1 -I http://127.0.0.1:3004/lich-gia-dinh/
curl -s https://lpc.vn/lich-gia-dinh/api/v1/health      # {"status":"ok","db":"ok"}
journalctl -u family-calendar-api -n 80 --no-pager
```

### Cập nhật về sau

```bash
cd /var/www/family-calendar && git pull --ff-only origin main
cd backend && npm ci && npm run deploy     # build + migration + restart api, worker
cd ../frontend && npm ci && npm run deploy # build + restart frontend
```

`deploy` gọi `sudo systemctl restart`, nên user chạy lệnh cần quyền sudo cho các unit đó.

### SEO and social previews

Set NEXT_PUBLIC_SITE_ORIGIN to the public HTTPS origin (no path) and NEXT_PUBLIC_BASE_PATH to the deployment prefix before building. These values are baked into canonical URLs, Open Graph, Twitter Cards, JSON-LD and sitemap.xml. Changing either value requires a rebuild.

Only the landing, about, help, terms, privacy and contact pages are indexed. Other routes emit noindex, follow while keeping generic brand previews. No family data is included in metadata or structured data.

For the current sub-path deployment, merge this line into the existing robots.txt at https://lpc.vn/robots.txt, preserving the Drupal site's existing rules:

```text
Sitemap: https://lpc.vn/lich-gia-dinh/sitemap.xml
```

Do not block /lich-gia-dinh/ in robots.txt: crawlers need to read page-level noindex and social metadata. A robots.txt served inside /lich-gia-dinh/ would not govern the domain. Do not replace the domain's existing file with an app-only robots file.

After deployment, verify the landing and each public canonical URL return 200 over HTTPS, the OG image returns image/png at 1200x630, and sitemap.xml returns application/xml with only the six public URLs. Test raw HTML with social crawler user agents as well as a browser. Confirm noindex on app, onboarding, invite, SOS, print and UI-kit routes. Social platforms may retain cached previews; request a re-scrape where supported.

## Gia đình cùng sử dụng

Cách mời, duyệt thành viên, quản lý thiết bị/quyền, đồng bộ và yêu cầu SMTP production: [docs/family-sharing.md](docs/family-sharing.md).
