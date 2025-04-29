import streamlit as st
from db.db_helper import authenticate_user
import time
from utils.navigate import navigate_to


def login_page(css_file):
    """Kullanıcı giriş sayfasını gösterir."""
    from utils.css import load_css, add_bg_from_url
    
    # Stil ve arka plan ekle
    load_css(css_file)
    add_bg_from_url()
    
    # Login durumu kontrolü - eğer önceden başarılı bir giriş yapıldıysa ana sayfaya yönlendir
    if 'login_success' in st.session_state and st.session_state.login_success:
        st.session_state.login_success = False  # Reset login success state
        st.session_state.authenticated = True
        # navigate_to("dashboard")
        st.rerun()
        return True
    
    # Sayfa düzeni
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        # Logo ve başlık
        # st.image("assets/images/opevaLogoPNG.png", width=200,  )
        st.markdown("<h1 class='title'>OPEVA SU</h1>", unsafe_allow_html=True)
        st.markdown("<h2 class='login-title'>Giriş Yap</h2>", unsafe_allow_html=True)
        
        # Hata mesajı için alan ayrılıyor
        login_error = st.empty()
        
        # Giriş formu
        with st.form("login_form", clear_on_submit=False):
            username_or_email = st.text_input("Kullanıcı ID veya E-posta", key="login_username")
            password = st.text_input("Şifre", type="password", key="login_password")
            
            col1, col2 = st.columns(2)
            with col1:
                submit = st.form_submit_button("Giriş Yap", use_container_width=True)
            with col2:
                demo_button = st.form_submit_button("Demo Giriş", use_container_width=True)
        
        # Form dışında işlem yap - bu sayede sayfa yeniden yüklenmeden önce işlemleri tamamlayabiliriz
        if submit or demo_button:
            # Demo giriş için varsayılan değerler
            if demo_button:
                username_or_email = "ct_0"
                password = "123"
            
            # MongoDB'den kullanıcı doğrulama
            user_info = authenticate_user(username_or_email, password)
            if user_info is not None:
                with st.spinner("Giriş yapılıyor..."):
                    # Giriş başarılı mesajı
                    st.success("✅ Giriş başarılı! Yönlendiriliyorsunuz...")
                    # Session state'i güncelle
                    st.session_state.user = user_info
                    st.session_state.authenticated = True
                    st.session_state.login_success = True
                    
                    # Dashboard sayfasına yönlendir
                    navigate_to("dashboard")
                    
                    # Kısa bekletme - sayfanın yeniden yüklenmesini sağlar
                    time.sleep(1)
                    st.rerun()
            else:
                # Hata mesajı göster
                login_error.error("❌ Kullanıcı adı/e-posta veya şifre hatalı!")
        
        st.markdown("</div>", unsafe_allow_html=True)
        
        # Alt bilgi
        st.markdown("<div class='footer'>© 2023 OPEVA Su Sipariş Sistemi</div>", unsafe_allow_html=True)
