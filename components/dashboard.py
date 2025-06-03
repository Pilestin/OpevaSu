import streamlit as st
import datetime
import uuid
from db.db_helper import get_product_by_id, get_order_count_by_status, save_order
from utils.navigate import NAV_OPTIONS, navigate_to, get_current_page, logout
from utils.css import load_css


st.set_page_config(
    page_title="Ana Sayfa",
    page_icon="🏠",
    layout="wide",
    initial_sidebar_state="expanded"
)

def generate_order_id():
    """Benzersiz sipariş ID'si oluşturur"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d")
    sequence = "001"  # Bu sayı veritabanından alınabilir
    return f"order_{timestamp}_{sequence}"

def generate_task_id():
    """Benzersiz görev ID'si oluşturur"""
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M")
    random_part = uuid.uuid4().hex[:6]
    return f"task_{timestamp}_{random_part}"

def sidebar():
    """Sidebar navigation menu"""
    is_admin = st.session_state.user.get("role") == "admin"

    st.title(st.session_state.user["full_name"])
    image_html = f"""
        <div class="profile-image-container">
            <img src="{st.session_state.user.get('profile_picture', 'default_profile.png')}" alt="Profil Resmi" class="profile-image">
        </div>
    """
    st.markdown(image_html, unsafe_allow_html=True)
    st.subheader(f"{st.session_state.user['role'].capitalize()} - {st.session_state.user['user_id']} ")
    st.write(st.session_state.user["email"])
    st.write(st.session_state.user["phone_number"])
    st.write(st.session_state.user["address"])
    st.container(height=50, border=False)

    # Show admin link only for admin users
    if is_admin:
        if st.sidebar.button("👑 Admin Panel", use_container_width=True):
            navigate_to("admin")
    
    if st.sidebar.button("🏠 Ana Sayfa", use_container_width=True):
        navigate_to("dashboard")
    
    if st.sidebar.button("📦 Siparişlerim", use_container_width=True):
        navigate_to("orders")
    
    if st.sidebar.button("👤 Profilim", use_container_width=True):
        navigate_to("profile")
    
    # Logout button at the bottom
    st.sidebar.markdown("---")
    if st.sidebar.button("🚪 Çıkış Yap", use_container_width=True):
        st.session_state.clear()
        navigate_to("login")
        st.rerun()

def write_product_info(product):
    """Ürün bilgilerini gösterir."""
    st.subheader("Ürün Bilgileri")
    
    product_id = product["product_id"]  # Ürün ID'si
    product_name = product["name"]  # Ürün adı
    product_description = product["description"]  # Ürün açıklaması
    product_price = product["price"]  # Ürün fiyatı
    product_category = product["category"]  # Ürün kategorisi
    product_image_url = product["image_url"]  # Ürün resmi
    
    product_html = f"""
        <div class="product-card">
            <div class="product-info">
                <h2>{product_name}</h2>
                <p><strong>Ürün Adı:</strong> {product_name}</p>
                <p><strong>Açıklama:</strong> {product_description}</p>
                <p><strong>Fiyat:</strong> ₺{product_price:.2f}</p>
                <p><strong>Kategori:</strong> {product_category}</p>
            </div>
            <div class="product-image">
                <img src='{product_image_url}' alt="{product_name}" class="product-image">
            </div>
        </div>
    """
    st.markdown(product_html, unsafe_allow_html=True)

def simple_order_form(user, product):
    """Basit bir sipariş formu gösterir."""
    st.subheader("Sipariş Ver")

    with st.form(key="order_form"):
        quantity = st.number_input("Sipariş Adeti", min_value=1, value=1)
        
        # Teslimat zamanı seçimi
        col1, col2 = st.columns(2)
        with col1:
            default_ready_time = datetime.time(9, 0)  # 09:00
            ready_time = st.time_input(
                "Hazır Olma Saati",
                value=default_ready_time,
                step=datetime.timedelta(minutes=1)
            )
        with col2:
            default_due_time = datetime.time(10, 0)  # 10:00
            due_time = st.time_input(
                "Teslim Saati",
                value=default_due_time,
                step=datetime.timedelta(minutes=1)
            )
        
        if due_time <= ready_time:
            st.error("⚠️ Teslim saati, hazır olma saatinden sonra olmalıdır!")
        
        # Sipariş notları
        notes = st.text_area(
            "Sipariş Notları",
            placeholder="Teslimat için eklemek istediğiniz notlar...",
            height=100
        )
        
        # Dinamik fiyat hesaplama
        product_price = product["price"]
        total_price = product_price * quantity
        
        # Fiyat bilgisi gösterimi
        st.markdown(f"""
            <div style='background-color: #f0f2f6; padding: 20px; border-radius: 10px;'>
                <p><strong>Birim Fiyat:</strong> ₺{product_price:.2f}</p>
                <p><strong>Sipariş Adeti:</strong> {quantity}</p>
                <h3>Toplam Tutar: ₺{total_price:.2f}</h3>
            </div>
        """, unsafe_allow_html=True)
        
        submitted = st.form_submit_button(label="Sipariş Ver", use_container_width=True)
    
    if submitted and due_time > ready_time:
        # Create order data
        now = datetime.datetime.now()
        # order_date = now
        order_id = generate_order_id()
        task_id = f"task_{now.strftime('%Y%m%d')}_{uuid.uuid4().hex[:3]}"
        
        order_data = {
            "order_id": order_id,
            "customer_id": user["user_id"],
            "task_id": task_id,
            "location": {
                "address": user.get("address", ""),
                "latitude": float(user.get("latitude", 39.7598)),
                "longitude": float(user.get("longitude", 30.5042))
            },
            "ready_time": ready_time.strftime("%H:%M"),
            "due_date": due_time.strftime("%H:%M"),
            "order_date": now,
            "service_time": 120,
            "request": {
                "product_id": product["product_id"],
                "product_name": product["name"],
                "notes": notes,
                "quantity": quantity,
                "demand": quantity * 19
            },
            "status": "waiting",
            "change_log": [],
            "assigned_vehicle": None,
            "assigned_route_id": None,
            "priority_level": 0,
            "total_price": total_price,
            "created_at": now,
            "updated_at": now
        }

        if save_order(order_data):
            st.success("✅ Sipariş başarıyla kaydedildi!")
            st.write("Sipariş ID:", order_id)
            st.write(order_data)
            if st.button("Siparişlerim Sayfasına Git"):
                navigate_to("orders")
                st.rerun()
        else:
            st.error("❌ Sipariş kaydedilirken bir hata oluştu.")

@st.cache_data(ttl=60)
def get_dashboard_data(user_id):
    """Dashboard verilerini döndürür."""
    order_counts = get_order_count_by_status(user_id)
    product = get_product_by_id("SU_0")
    return order_counts, product

def dashboard_page(css_file=None):
    """Ana sayfa içeriğini gösterir."""

    # Stil ekle
    if css_file:
        load_css(css_file)
    
    # Sidebar Navigation
    with st.sidebar:
        sidebar()
    
    # Ana içerik
    st.markdown("<h1 class='page-title'>Ana Sayfa</h1>", unsafe_allow_html=True)
    
    # Verileri cache'den al
    order_counts, product = get_dashboard_data(st.session_state.user["user_id"])
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("<div class='dashboard-card'>", unsafe_allow_html=True)
        st.markdown("<h3>Bekleyen Siparişler</h3>", unsafe_allow_html=True)
        st.markdown(f"<div class='dashboard-number'>{order_counts['waiting']}</div>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
        
    with col2:
        st.markdown("<div class='dashboard-card'>", unsafe_allow_html=True)
        st.markdown("<h3>Tamamlanan Siparişler</h3>", unsafe_allow_html=True)
        st.markdown(f"<div class='dashboard-number'>{order_counts['completed']}</div>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
        
    with col3:
        st.markdown("<div class='dashboard-card'>", unsafe_allow_html=True)
        st.markdown("<h3>Toplam Sipariş Adeti</h3>", unsafe_allow_html=True)
        st.markdown(f"<div class='dashboard-number'>{order_counts['total']}</div>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)
    
    if product is None:
        st.error("Ürün bulunamadı.")
        return
    
    write_product_info(product)
    
    if st.session_state.user.get("role") == "admin":
        st.info("🔒 Admin kullanıcıları sipariş sayfasına erişemez. Siparişleri yönetmek için Admin Panelini kullanabilirsiniz.")
        return
    else:
        # Use the new simpler form
        simple_order_form(st.session_state.user, product)

