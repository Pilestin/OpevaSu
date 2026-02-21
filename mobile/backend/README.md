# OpevaSu Mobile Backend (Node.js)

Mobil uygulama icin Python'dan bagimsiz backend.

## Kurulum

```bash
cd mobile/backend
npm install
```

## Ortam Degiskenleri

`.env.example` dosyasini `.env` olarak kopyalayin:

```env
PORT=3001
MONGODB_URI=mongodb://username:password@hostname:port/database
MONGO_DB_NAME=RouteManagementDB
JWT_SECRET=change-me-mobile-backend-min-32-chars
JWT_EXPIRES_IN=60m
ALLOW_PASSWORDLESS_LOGIN=true
```

`ALLOW_PASSWORDLESS_LOGIN=true` oldugunda sadece `user_id_or_email` ile giris yapilabilir (development icin).

## Calistirma

```bash
npm run dev
```

## Endpointler

- `GET /health`
- `POST /auth/login`
- `GET /products`
- `GET /orders`
- `POST /orders`
- `PUT /orders/:orderId`
- `DELETE /orders/:orderId`
- `GET /profile/:userId`
- `PUT /profile/:userId`

`POST /orders` davranisi:
- `Packet/Paket/Package` urunleri `Orders_S` koleksiyonuna yazilir.
- Diger urunler `Orders` koleksiyonuna yazilir.
