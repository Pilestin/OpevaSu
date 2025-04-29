import os
import base64
import streamlit as st

# CSS dosyasını yükle
def load_css(css_file):
    try:
        if os.path.exists(css_file):
            with open(css_file) as f:
                st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)
        else:
            st.warning(f"CSS dosyası bulunamadı: {css_file}")
    except Exception as e:
        st.error(f"CSS yüklenirken hata oluştu: {e}")

# Arkaplan resmi yükleme fonksiyonu
def add_bg_from_url(image_file='assets/images/background.jpg'):
    try:
        with open(image_file, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode()
        
        st.markdown(
            f"""
            <style>
            .stApp {{
                background-image: url("data:image/png;base64,{encoded_string}");
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            }}
            </style>
            """,
            unsafe_allow_html=True
        )
    except Exception:
        # Dosya bulunamazsa varsayılan arka plan
        st.markdown(
            """
            <style>
            .stApp {
                background: linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%);
            }
            </style>
            """, 
            unsafe_allow_html=True
        )