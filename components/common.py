import streamlit as st
import time

def show_loading_screen(message="Yükleniyor..."):
    """Yükleme ekranını gösterir."""
    with st.spinner(message):
        progress_bar = st.progress(0)
        for i in range(100):
            time.sleep(0.01)
            progress_bar.progress(i + 1)
        st.success("Tamamlandı!")
        time.sleep(0.5)
        st.empty()

def show_temporary_message(message, message_type="info", duration=3):
    """Geçici mesaj gösterir ve sonra otomatik olarak kaldırır."""
    message_placeholder = st.empty()
    
    if message_type == "success":
        message_placeholder.success(message)
    elif message_type == "error":
        message_placeholder.error(message)
    elif message_type == "warning":
        message_placeholder.warning(message)
    else:
        message_placeholder.info(message)
    
    time.sleep(duration)
    message_placeholder.empty()

def create_redirect_script(page):
    """JavaScript yönlendirme kodu oluşturur."""
    return f"""
    <script>
        setTimeout(function() {{
            window.location.href = "/?page={page}";
        }}, 500);
    </script>
    """
