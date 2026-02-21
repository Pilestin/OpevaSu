# MongoDB TabanlÄ± SipariÅŸ YÃ¶netim UygulamasÄ±

Bu uygulama, MongoDB veritabanÄ± kullanarak kimlik doÄŸrulama ve sipariÅŸ yÃ¶netimi iÅŸlemlerini gerÃ§ekleÅŸtiren bir Streamlit web uygulamasÄ±dÄ±r.

## Ã–zellikler

- KullanÄ±cÄ± kimlik doÄŸrulama (MongoDB users koleksiyonu ile)
- SipariÅŸ oluÅŸturma ve kaydetme
- Tarih ve saat seÃ§imi

## Kurulum

1. Gerekli kÃ¼tÃ¼phaneleri yÃ¼kleyin:

```bash
pip install -r requirements.txt
```

2. MongoDB'nin kurulu ve Ã§alÄ±ÅŸÄ±yor olduÄŸundan emin olun.

3. Ã–rnek veritabanÄ±nÄ± kurun:

```bash
python setup_db.py
```

4. UygulamayÄ± Ã§alÄ±ÅŸtÄ±rÄ±n:

```bash
streamlit run app.py
```

## KullanÄ±m

- GiriÅŸ sayfasÄ±nda kullanÄ±cÄ± ID'nizi girin (Ã¶rn. "user1", "user2" veya "admin")
- Åifre alanÄ±na "123" yazÄ±n
- GiriÅŸ yaptÄ±ktan sonra sipariÅŸ adetini ve tarih/saati seÃ§erek yeni sipariÅŸ oluÅŸturabilirsiniz

## VeritabanÄ± YapÄ±sÄ±

- **users**: KullanÄ±cÄ± bilgilerini iÃ§eren koleksiyon
- **orders**: SipariÅŸ bilgilerini iÃ§eren koleksiyon

## GeliÅŸtirme NotlarÄ±

- Bu uygulama demonstrasyon amaÃ§lÄ±dÄ±r ve gerÃ§ek ortamda kullanÄ±lmadan Ã¶nce gÃ¼venlik iyileÅŸtirmeleri yapÄ±lmalÄ±dÄ±r
- Åifre doÄŸrulamasÄ± ÅŸu anda basit bir kontrol ile yapÄ±lmaktadÄ±r, gerÃ§ek uygulamalarda hash ve tuz kullanÄ±lmalÄ±dÄ±r

## Uygulama GÃ¶rselleri 


<h2>Uygulama GÃ¶rselleri</h2>

<div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: start;">
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/Screenshot_1.png" alt="GiriÅŸ SayfasÄ±" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">GiriÅŸ SayfasÄ±</p>
  </div>
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/Screenshot_2.png" alt="Ana Sayfa" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">Ana Sayfa</p>
  </div>
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/Screenshot_3.png" alt="SipariÅŸ OluÅŸturma" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">SipariÅŸ OluÅŸturma</p>
  </div>
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/Screenshot_5.png" alt="SipariÅŸ OluÅŸturma 2" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">SipariÅŸ OluÅŸturma 2</p>
  </div>
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/Screenshot_6.png" alt="Profil Bilgileri" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">Profil Bilgileri</p>
  </div>
</div>

<h3>Admin SayfalarÄ±</h3>

<div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: start;">
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/admin_1.png" alt="Admin SayfasÄ±" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">Admin SayfasÄ±</p>
  </div>
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots_v2/admin_2.png" alt="Admin - KullanÄ±cÄ± Listesi" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">KullanÄ±cÄ± Listesi</p>
  </div>
  <div style="flex: 0 0 48%;">
    <img src="assets/screenshots/Screenshot_6.png" alt="Admin - SipariÅŸ Listesi" style="width: 100%;">
    <p style="text-align:center; font-size:14px;">SipariÅŸ Listesi</p>
  </div>
</div>



## KatkÄ±da Bulunanlar





## Mobile Backend (Node.js)

Mobil istemci Python API yerine `mobile/backend/` servisine baglanir.

Ortam degiskenleri (`mobile/backend/.env`):
- `MONGODB_URI`
- `MONGO_DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

Calistirma:
- cd mobile/backend
- npm install
- npm run dev

Mobil app (`mobile/app/.env`):
- `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001`
