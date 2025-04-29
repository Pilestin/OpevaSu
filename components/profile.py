import streamlit as st
from db.db_helper import update_user_profile

def profile_page(css_file):
    """Profil sayfasını gösterir."""
    from utils.css import load_css
    from components.dashboard import sidebar
    
    # Stil ekle
    load_css(css_file)
    
    # Sidebar Navigation
    with st.sidebar:
        sidebar()
    
    # Ana içerik
    st.markdown("<h1 class='page-title'>Profil Bilgilerim</h1>", unsafe_allow_html=True)
    
    user = st.session_state.user
    
    # Profil bilgileri ve düzenleme
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.markdown("<div class='profile-image-container'>", unsafe_allow_html=True)
        if 'profile_picture' in user and user['profile_picture']:
            st.image(user['profile_picture'], width=200)
        else:
            # Varsayılan profil resmi
            st.markdown("<div class='default-profile'>👤</div>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
    
    with col2:
        st.markdown("<div class='profile-details'>", unsafe_allow_html=True)
        
        # Kullanıcı bilgileri formu - Tek form altında toplandı
        with st.form("profile_form"):
            user_id = st.text_input("Kullanıcı ID", value=user.get("user_id", ""), disabled=True)
            email = st.text_input("E-posta", value=user.get("email", ""))
            full_name = st.text_input("Ad Soyad", value=user.get("full_name", ""))
            phone_number = st.text_input("Telefon", value=user.get("phone_number", ""))
            address = st.text_area("Adres", value=user.get("address", ""))
            
            # Profil resmi URL'si formu ana forma taşındı
            profile_picture_url = st.text_input(
                "Profil Resmi URL'si",
                value=user.get('profile_picture', ''),
                placeholder="https://example.com/image.jpg"
            )
            
            # Konum bilgileri
            col1, col2 = st.columns(2)
            with col1:
                latitude = st.text_input("Enlem", value=str(user.get("latitude", "")))
            with col2:
                longitude = st.text_input("Boylam", value=str(user.get("longitude", "")))
            
            # Şifre değişikliği
            st.markdown("---")
            st.markdown("**Şifre Değiştir** (değiştirmek istemiyorsanız boş bırakın)")
            
            col1, col2 = st.columns(2)
            with col1:
                password = st.text_input("Yeni Şifre", type="password")
            with col2:
                password_confirm = st.text_input("Şifre (Tekrar)", type="password")
            
            submitted = st.form_submit_button("Bilgileri Güncelle", use_container_width=True)
        
        if submitted:
            if password and password != password_confirm:
                st.error("❌ Girilen şifreler eşleşmiyor!")
            else:
                # Güncelleme verilerini hazırla
                update_data = {
                    "email": email,
                    "full_name": full_name,
                    "phone_number": phone_number,
                    "address": address,
                    "profile_picture": profile_picture_url  # Profil resmi URL'si eklendi
                }
                
                # İsteğe bağlı alanları ekle
                if latitude and longitude:
                    try:
                        update_data["latitude"] = float(latitude)
                        update_data["longitude"] = float(longitude)
                    except ValueError:
                        st.warning("⚠️ Enlem ve boylam sayısal değer olmalıdır.")
                
                if password:
                    update_data["password"] = password
                
                success, result = update_user_profile(user["user_id"], update_data)
                
                if success:
                    st.session_state.user = result
                    st.success("✅ Profil bilgileri başarıyla güncellendi!")
                    st.rerun()
                else:
                    st.error(f"❌ Profil güncellenemedi: {result}")
        
        st.markdown("</div>", unsafe_allow_html=True)
