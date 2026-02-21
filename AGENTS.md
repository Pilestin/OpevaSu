# OpevaSu - Uygulama Ozeti ve Yol Haritasi

## Uygulama Nedir?
- OpevaSu, Streamlit tabanli bir siparis yonetim uygulamasidir.
- Kullanicilar giris yapar, siparis olusturur ve siparislerini takip eder.
- Yonetici (admin) tarafinda kullanici ve siparis goruntuleme/yonetim akislar bulunur.
- Veri katmani MongoDB ile calisir.

## Hedef
Mevcut Streamlit uygulamasini koruyarak, Expo (React Native) ile hizli gelistirilebilir bir mobil istemci eklemek.

## Adim Adim Yol Haritasi (Guncel Durum)
- [x] **Kesif ve kapsam netlestirme**
  - [x] Mevcut Streamlit akislarini (login, dashboard, orders, profile, admin) netlestir
  - [x] Mobil MVP kapsamini belirle: kullanici tarafinda siparis girme + siparis takip
- [x] **API katmani olusturma (Streamlit korunarak)**
  - [x] Mobilin kullanacagi REST endpoint'lerini ekle (Node backend: auth, orders, profile)
  - [x] Basit token tabanli kimlik dogrulama uygula
- [x] **Expo mobil uygulama iskeleti**
  - [x] Expo projesini olustur
  - [x] Navigasyon yapisini kur (Auth, Siparisler, Profil)
  - [x] Ortam degiskenleri ve API istemcisini ayarla
- [x] **Kullanici siparis akislar (MVP)**
  - [x] Giris ekrani
  - [x] Siparis olusturma ekrani
  - [x] Siparis listesi/durum takip ekrani
- [ ] **Ortak dogrulama ve kalite**
  - [x] Mobilde temel hata/bos durum yonetimi
  - [x] Dokumantasyon guncellemesi (calistirma adimlari + ortam degiskenleri)
  - [x] Mimari dokuman
  - [x] Kapsamli smoke checklist dokumani
  - [x] Mobile backend smoke checklist calistirma ve sonuclari
  - [ ] Streamlit ve mobile uygulama smoke checklist calistirma ve sonuclari

## Mimari Yaklasim (Kisa)
- Streamlit: Web arayuzu olarak aynen devam eder.
- Mobil backend: Node.js + Express + MongoDB (`mobile/backend/`) olarak ayridir.
- Expo mobil: Python yerine sadece Node backend'e baglanir.

# SKILL - OpevaSu Gelistirme Yetkinlikleri

SKILL dokumantasyonu yon bazli olarak `.agent/` klasoru altina bolunmustur:

- `.agent/product/SKILL.md`
- `.agent/frontend/SKILL.md`
- `.agent/backend/SKILL.md`
- `.agent/mobile/SKILL.md`
- `.agent/quality/SKILL.md`
