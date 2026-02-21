# OpevaSu Smoke Checklist

## Streamlit (Web)
- [ ] Login: basarili giris
- [ ] Login: hatali sifre
- [ ] Dashboard: siparis sayaclari goruntulenir
- [ ] Siparis olusturma: basarili kayit
- [ ] Siparis listesi: filtreleme
- [ ] Profil: bilgi guncelleme
- [ ] Admin: kullanici listesi
- [ ] Admin: tum siparisler

## Mobile Backend (Node.js)
- [ ] `POST /auth/login` (200 + token)
- [ ] `POST /auth/login` (401)
- [ ] `GET /orders` (401 token yokken)
- [ ] `GET /orders` (200 token ile)
- [ ] `POST /orders` (201 token ile)
- [ ] `GET /profile/:userId` (200 token ile)
- [ ] `PUT /profile/:userId` (200 token ile)

## Mobile (Expo)
- [ ] Login akisi
- [ ] Siparis listeleme
- [ ] Siparis olusturma
- [ ] Profil guncelleme
- [ ] Logout akisi
