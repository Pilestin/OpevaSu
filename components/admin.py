import streamlit as st
from db.db_helper import get_all_users, get_all_orders, get_active_orders, get_product_list, save_order
from components.dashboard import sidebar
import datetime
import uuid

def admin_page(css_file):
    """Admin paneli sayfasını gösterir."""
    from utils.css import load_css

    # Check if user is admin
    if not st.session_state.user.get("role") == "admin":
        st.error("Bu sayfaya erişim yetkiniz yok!")
        return

    # Stil ekle
    load_css(css_file)

    # Sidebar Navigation
    with st.sidebar:
        sidebar()

    st.markdown("<h1 class='page-title'>Admin Paneli</h1>", unsafe_allow_html=True)

    # Create tabs for different sections
    tab1, tab2, tab3, tab4 = st.tabs(["👥 Kullanıcılar", "📦 Tüm Siparişler", "🚚 Aktif Siparişler", "⚡ Hızlı Sipariş ekle"])

    with tab1:
        st.subheader("Sistem Kullanıcıları")
        users = get_all_users()
        if users:
            # Create a dataframe for users
            user_data = []
            for user in users:
                user_data.append({
                    "ID": user.get("user_id"),
                    "Ad Soyad": user.get("full_name"),
                    "Email": user.get("email"),
                    "Rol": user.get("role", "user"),
                    "Durum": "Aktif" if user.get("is_active", True) else "Pasif"
                })
            st.dataframe(user_data, use_container_width=True)
        else:
            st.info("Henüz kayıtlı kullanıcı bulunmuyor.")

    with tab2:
        st.subheader("Tüm Siparişler")
        orders = get_all_orders()
        if orders:
            # Create a dataframe for all orders
            order_data = []
            for order in orders:
                order_data.append({
                    "Sipariş ID": order.get("order_id"),
                    "Müşteri": order.get("customer_id"),
                    "Durum": order.get("status"),
                    "Ürün": order.get("request", {}).get("product_name"),
                    "Miktar": order.get("request", {}).get("quantity"),
                    "Toplam": f"₺{order.get('total_price', 0):.2f}",
                    "Tarih": order.get("created_at").strftime("%d.%m.%Y %H:%M") if order.get("created_at") else "-"
                })
            st.dataframe(order_data, use_container_width=True)
        else:
            st.info("Henüz sipariş bulunmuyor.")

    with tab3:
        st.subheader("Aktif Siparişler")
        active_orders = get_active_orders()
        if active_orders:
            # Create a dataframe for active orders
            active_data = []
            for order in active_orders:
                active_data.append({
                    "Sipariş ID": order.get("order_id"),
                    "Müşteri": order.get("customer_id"),
                    "Durum": order.get("status"),
                    "Teslim Saati": order.get("due_date"),
                    "Adres": order.get("location", {}).get("address"),
                    "Araç": order.get("assigned_vehicle", "Atanmadı")
                })
            st.dataframe(active_data, use_container_width=True)
        else:
            st.info("Aktif sipariş bulunmuyor.")

    with tab4:
        st.subheader("Hızlı Sipariş Oluştur")

        # Form oluştur
        with st.form("quick_order_form"):
            # Kullanıcı seçimi
            users = get_all_users()
            user_options = {f"{user['user_id']} - {user['full_name']}": user for user in users}
            selected_user = st.selectbox(
                "Müşteri Seçin",
                options=list(user_options.keys())
            )

            # Ürün seçimi
            products = get_product_list()
            product_options = {f"{p['name']} (₺{p['price']})": p for p in products}
            selected_product = st.selectbox(
                "Ürün Seçin",
                options=list(product_options.keys())
            )

            # Sipariş miktarı
            
            quantity = st.number_input("Sipariş Adeti", min_value=1, value=1)
            # with col2:
            #     demand = st.number_input("Talep (Litre)", min_value=19, value=19)
            
            # Teslimat zamanı
            col1, col2 = st.columns(2)
            with col1:
                delivery_slots = [
                    "09:00-10:00", "10:00-11:00", "11:00-12:00",
                    "12:00-13:00", "13:00-14:00", "14:00-15:00",
                    "15:00-16:00", "16:00-17:00", "17:00-18:00"
                ]
                delivery_time = st.selectbox("Teslimat Saati", options=delivery_slots)
            with col2:
                service_time = st.number_input("Servis Süresi (sec)", min_value=5, value=120)

            # Notlar
            notes = st.text_area("Sipariş Notları", placeholder="Varsa eklemek istediğiniz notlar...")

            submitted = st.form_submit_button("Sipariş Oluştur", use_container_width=True)

        if submitted:
            try:
                # Seçilen kullanıcı ve ürün bilgilerini al
                user = user_options[selected_user]
                product = product_options[selected_product]

                demand = quantity * product["weight"]["value"]  # Varsayılan olarak 19 litre
                # Teslimat zamanlarını ayır
                ready_time, due_time = delivery_time.split("-")

                # Sipariş verisi oluştur
                now = datetime.datetime.now()
                order_id = f"order_{now.strftime('%Y%m%d')}_{uuid.uuid4().hex[:3]}"
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
                    "ready_time": str(ready_time),
                    "due_date": str(due_time),
                    "service_time": str(service_time),
                    "request": {
                        "product_id": product["product_id"],
                        "product_name": product["name"],
                        "notes": notes,
                        "quantity": quantity,
                        "demand": demand
                    },
                    "status": "waiting",
                    "change_log": [],
                    "assigned_vehicle": None,
                    "assigned_route_id": None,
                    "priority_level": 0,
                    "total_price": product["price"] * quantity,
                    "created_at": now,
                    "updated_at": now
                }

                # Siparişi kaydet
                if save_order(order_data):
                    st.success(f"✅ Sipariş başarıyla oluşturuldu! (Sipariş ID: {order_id})")
                    # Aktif siparişler tabını güncelle
                    st.rerun()
                else:
                    st.error("❌ Sipariş oluşturulurken bir hata oluştu!")

            except Exception as e:
                st.error(f"❌ Bir hata oluştu: {str(e)}")