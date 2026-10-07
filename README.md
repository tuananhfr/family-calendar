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
