# OpevaSu Mobile (Expo)

## 1) Kurulum

```bash
cd mobile/app
npm install
```

## 2) Ortam Degiskeni

`.env.example` dosyasini `.env` olarak kopyalayin ve API adresini ayarlayin:

```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
```

Telefon cihazinda test ederken `127.0.0.1` yerine bilgisayarinizin LAN IP adresini kullanin.

## 2.1) EAS Build icin .env notu

`eas build` cloud ortaminda calistigi icin yerel `.env` dosyaniz otomatik olarak gitmez.
APK/AAB build'lerinde API adresini EAS environment variable olarak tanimlayin:

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value http://157.230.17.89:3003 --environment preview
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value http://157.230.17.89:3003 --environment production
```

## 2.2) Mobile Backend (Node.js)

Mobil uygulama Python backend'e baglanmaz. Asagidaki backend'i calistirin:

```bash
cd ../backend
npm install
npm run dev
```

## 3) Calistirma

```bash
npm run start
```

## Ekranlar

- Giris
- Siparislerim
- Yeni Siparis
- Profil
