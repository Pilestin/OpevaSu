import streamlit as st
import os
from utils.css import load_css
from utils.navigate import initialize_navigation, get_current_page, navigate_to

# Import page files
from components.login import login_page
from components.dashboard import dashboard_page
from components.orders import orders_page
from components.profile import profile_page
from components.admin import admin_page

# Dosya yolları ayarları
current_directory = os.path.dirname(os.path.abspath(__file__))
assets_directory = os.path.join(current_directory, "assets")
css_file = os.path.join(os.path.dirname(__file__), 'assets', 'style.css')

# Session state yönetimi
def initialize_session_state():
    """Uygulama için gerekli session state değerlerini başlat"""
    if "authenticated" not in st.session_state:
        st.session_state.authenticated = False
    if "user" not in st.session_state:
        st.session_state.user = None
    if "login_success" not in st.session_state:
        st.session_state.login_success = False
    if "page_initialized" not in st.session_state:
        st.session_state.page_initialized = {}
    
    # Navigasyon için session state'i başlat
    initialize_navigation()

# Ana uygulama akışı
def main():
    """Ana uygulama giriş noktası"""
    if "initialized" not in st.session_state:
        initialize_session_state()
        st.session_state.initialized = True
    
    # CSS sadece bir kez yükle
    if "css_loaded" not in st.session_state:
        load_css(css_file)
        st.session_state.css_loaded = True
    
    # Oturum kontrolü
    if not st.session_state.authenticated:
        login_page(css_file)
    else:
        # Sayfaya göre içerik gösterme
        current_page = get_current_page()
        
        # Check if user is admin
        is_admin = st.session_state.user.get("role") == "admin"
        
        # If user is not admin and tries to access admin page, redirect to dashboard
        if current_page == "admin" and not is_admin:
            navigate_to("dashboard")
            st.rerun()
        
        # Show appropriate page based on current_page
        if current_page == "admin":
            admin_page(css_file)
        elif current_page == "dashboard":
            dashboard_page(css_file)
        elif current_page == "orders":
            orders_page(css_file)
        elif current_page == "profile":
            profile_page(css_file)
        else:
            dashboard_page(css_file)

if __name__ == "__main__":
    main()