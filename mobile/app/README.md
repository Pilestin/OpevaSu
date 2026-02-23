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
EXPO_PUBLIC_ROUTING_ALNS_URL=http://YOUR_SERVER_HOST:8005/start_alns
EXPO_PUBLIC_ROUTING_ALNSTW_URL=http://YOUR_SERVER_HOST:8012/start_alnstw
EXPO_PUBLIC_ROUTING_DQN_URL=http://YOUR_SERVER_HOST:8006/start_dqn
EXPO_PUBLIC_ROUTING_QLEARNING_URL=http://YOUR_SERVER_HOST:8007/start_qlearning
EXPO_PUBLIC_ROUTING_SA_URL=http://YOUR_SERVER_HOST:8005/start_sa
EXPO_PUBLIC_ROUTING_TS_URL=http://YOUR_SERVER_HOST:8005/start_ts
```

Telefon cihazinda test ederken `127.0.0.1` yerine bilgisayarinizin LAN IP adresini kullanin.
Routing panel endpointleri (`ALNS`, `ALNSTW`, `DQN`, `Qlearning`, `SA`, `TS`) ayri env olarak yonetilir.

## 2.1) Opsiyonel Google Maps API Key

`react-native-maps` Expo Go'da key olmadan calisabilir. Ancak release buildlerde cihaz/policy farklarina gore key ihtiyaci dogabilir.
Bu nedenle key opsiyonel tutulmustur:

```bash
eas env:create --name GOOGLE_MAPS_API_KEY --value <YOUR_KEY> --environment preview --visibility sensitive
eas env:create --name GOOGLE_MAPS_API_KEY --value <YOUR_KEY> --environment production --visibility sensitive
```

## 2.2) EAS Build icin .env notu

`eas build` cloud ortaminda calistigi icin yerel `.env` dosyaniz otomatik olarak gitmez.
APK/AAB build'lerinde API adresini EAS environment variable olarak tanimlayin:

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value http://YOUR_SERVER_HOST:3003 --environment preview
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value http://YOUR_SERVER_HOST:3003 --environment production
eas env:create --name EXPO_PUBLIC_ROUTING_ALNS_URL --value http://YOUR_SERVER_HOST:8005/start_alns --environment preview
eas env:create --name EXPO_PUBLIC_ROUTING_ALNSTW_URL --value http://YOUR_SERVER_HOST:8012/start_alnstw --environment preview
eas env:create --name EXPO_PUBLIC_ROUTING_DQN_URL --value http://YOUR_SERVER_HOST:8006/start_dqn --environment preview
eas env:create --name EXPO_PUBLIC_ROUTING_QLEARNING_URL --value http://YOUR_SERVER_HOST:8007/start_qlearning --environment preview
eas env:create --name EXPO_PUBLIC_ROUTING_SA_URL --value http://YOUR_SERVER_HOST:8005/start_sa --environment preview
eas env:create --name EXPO_PUBLIC_ROUTING_TS_URL --value http://YOUR_SERVER_HOST:8005/start_ts --environment preview
eas env:create --name EXPO_PUBLIC_ROUTING_ALNS_URL --value http://YOUR_SERVER_HOST:8005/start_alns --environment production
eas env:create --name EXPO_PUBLIC_ROUTING_ALNSTW_URL --value http://YOUR_SERVER_HOST:8012/start_alnstw --environment production
eas env:create --name EXPO_PUBLIC_ROUTING_DQN_URL --value http://YOUR_SERVER_HOST:8006/start_dqn --environment production
eas env:create --name EXPO_PUBLIC_ROUTING_QLEARNING_URL --value http://YOUR_SERVER_HOST:8007/start_qlearning --environment production
eas env:create --name EXPO_PUBLIC_ROUTING_SA_URL --value http://YOUR_SERVER_HOST:8005/start_sa --environment production
eas env:create --name EXPO_PUBLIC_ROUTING_TS_URL --value http://YOUR_SERVER_HOST:8005/start_ts --environment production
```

## 2.3) Mobile Backend (Node.js)

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

## 3.1) Web'de Acma

```bash
npm run web
```

Komut sonrasi terminalde verilen adresten (genelde `http://localhost:8081`) web arayuzunu acabilirsiniz.

## Ekranlar

- Giris
- Siparislerim
- Yeni Siparis
- Profil
- Kullanicilar (admin)
- Rotalama (admin)
