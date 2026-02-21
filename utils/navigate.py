import streamlit as st


NAV_OPTIONS = {
    "dashboard": "📊 Ana Sayfa",
    "orders": "📦 Siparişlerim",
    "profile": "👤 Profilim"
}

def get_nav_options(user):
    """Kullanıcı rolüne göre navigasyon menüsünü döndürür."""
    options = dict(NAV_OPTIONS)

    # Admin için ek menü
    if user.get("role") == "admin":
        options["admin"] = "⚙️ Admin Paneli"

    return options

def initialize_navigation():
    """
    Navigasyon için gerekli session state değişkenlerini başlatır.
    """
    if "current_page" not in st.session_state:
        st.session_state.current_page = "login"
    
    if "page_history" not in st.session_state:
        st.session_state.page_history = []

def navigate_to(page):
    """Belirtilen sayfaya navigasyon yapar."""
    if st.session_state.current_page != page:
        st.session_state.current_page = page

def navigate_back():
    """
    Önceki sayfaya geri döner.
    
    Returns:
        bool: Geri dönülebildiyse True, aksi halde False
    """
    if st.session_state.page_history:
        previous_page = st.session_state.page_history.pop()
        st.session_state.current_page = previous_page
        return True
    return False

def get_current_page():
    """
    Mevcut sayfayı döndürür.
    
    Returns:
        str: Mevcut sayfa adı
    """
    return st.session_state.current_page

def logout():
    """Kullanıcının oturumunu sonlandırır."""
    for key in list(st.session_state.keys()):
        if key not in ["_is_running", "_script_run_ctx"]:
            del st.session_state[key]
    st.session_state.current_page = "login"
