# OpevaSu - Uygulama Özeti ve Yol Haritası

## Uygulama Nedir?
- OpevaSu, Streamlit tabanlı bir sipariş yönetim uygulamasıdır.
- Kullanıcılar giriş yapar, sipariş oluşturur ve siparişlerini takip eder.
- Yönetici (admin) tarafında kullanıcı ve sipariş görüntüleme/yönetim akışları bulunur.
- Veri katmanı MongoDB ile çalışır.

## Hedef
Mevcut Streamlit uygulamasını koruyarak, Expo (React Native) ile hızlı geliştirilebilir bir mobil istemci eklemek.

## Adım Adım Yol Haritası
- [ ] **Keşif ve kapsam netleştirme**
  - [ ] Mevcut Streamlit akışlarını (login, dashboard, orders, profile, admin) netleştir
  - [ ] Mobil MVP kapsamını belirle: kullanıcı tarafında sipariş girme + sipariş takip
- [ ] **API katmanı oluşturma (Streamlit korunarak)**
  - [ ] Mevcut iş kurallarını servis katmanına taşı
  - [ ] Mobilin kullanacağı REST endpoint’lerini ekle (auth, orders, profile)
  - [ ] Basit token tabanlı kimlik doğrulama uygula
- [ ] **Expo mobil uygulama iskeleti**
  - [ ] Expo projesini oluştur
  - [ ] Navigasyon yapısını kur (Auth, Siparişler, Profil)
  - [ ] Ortam değişkenleri ve API istemcisini ayarla
- [ ] **Kullanıcı sipariş akışları (MVP)**
  - [ ] Giriş ekranı
  - [ ] Sipariş oluşturma ekranı
  - [ ] Sipariş listesi/durum takip ekranı
- [ ] **Ortak doğrulama ve kalite**
  - [ ] Streamlit tarafında regresyon kontrolü
  - [ ] Mobilde temel hata/boş durum yönetimi
  - [ ] Dokümantasyon güncellemesi (çalıştırma adımları + mimari)

## Mimari Yaklaşım (Kısa)
- Streamlit: Web arayüzü olarak aynen devam eder.
- Backend mantığı: Ortak servis/endpoint yapısına taşınır.
- Expo mobil: Aynı backend’e bağlanan ikinci istemci olur.
