# OpevaSu Uygulama Plani (Streamlit Korunarak)

## Hedef
Mevcut Streamlit uygulamasini bozmadan, Expo mobil istemciyi Node.js mobile backend ile calistirmak.

## Prensipler
- Streamlit akislari calisir kalir.
- Mobil frontend (`mobile/app/`) ve mobil backend (`mobile/backend/`) ayridir.
- Mobil taraf Python API'ye bagli degildir.

## Asama 1 - Mobil Temel (Tamamlandi)
- [x] Expo proje iskeleti
- [x] Auth + tab navigasyon
- [x] Login / Siparisler / Yeni Siparis / Profil ekranlari
- [x] AsyncStorage ile oturum saklama

## Asama 2 - Mobile Backend (Tamamlandi)
- [x] `mobile/backend/` Node.js/Express kurulumu
- [x] MongoDB baglantisi (`MONGODB_URI`)
- [x] Endpointler: auth / orders / profile
- [x] JWT tabanli auth ve rol kontrolu

## Asama 3 - Dokumantasyon (Tamamlandi)
- [x] Mobil calistirma adimlari
- [x] Backend calistirma adimlari
- [x] Mimari ozeti

## Asama 4 - Kalite (Devam Ediyor)
- [ ] Streamlit smoke checklist
- [ ] Mobile app smoke checklist
- [ ] Mobile backend endpoint smoke checklist
