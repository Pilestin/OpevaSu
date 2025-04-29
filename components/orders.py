import streamlit as st
import datetime
from db.db_helper import get_user_orders, get_order_history, update_order_status
from utils.navigate import navigate_to

def orders_page(css_file):
    """Siparişler sayfasını gösterir."""
    from utils.css import load_css
    from components.dashboard import sidebar
    
    # Stil ekle
    load_css(css_file)
    
    # Sidebar Navigation
    with st.sidebar:
        sidebar()
    
    # Ana içerik
    st.markdown("<h1 class='page-title'>Siparişlerim</h1>", unsafe_allow_html=True)
    
    # Filtre bölümü
    st.markdown("<div class='filter-container'>", unsafe_allow_html=True)
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    
    with col1:
        status_filter = st.selectbox("Durum", ["Tümü", "Bekliyor", "Hazırlanıyor", "Yolda", "Teslim Edildi"])
    with col2:
        start_date = st.date_input("Başlangıç Tarihi", value=datetime.datetime.now() - datetime.timedelta(days=30))
    with col3:
        end_date = st.date_input("Bitiş Tarihi", value=datetime.datetime.now())
    with col4:
        filter_button = st.button("Filtrele", use_container_width=True)
    
    st.markdown("</div>", unsafe_allow_html=True)
    
    # Sessiom state ile sipariş detaylarını takip et
    if 'selected_order' not in st.session_state:
        st.session_state.selected_order = None
    
    # Siparişleri veritabanından al
    orders = get_user_orders(
        st.session_state.user["user_id"], 
        status=status_filter if status_filter != "Tümü" else None,
        start_date=start_date,
        end_date=end_date
    )
    
    if not orders:
        st.info("Bu kriterlere uygun sipariş bulunamadı.")
    else:
        # Siparişleri listele
        st.markdown("<div class='orders-list'>", unsafe_allow_html=True)
        
        for order in orders:
            # Durum bilgisini Türkçeleştir
            status_mapping = {
                "waiting": "Bekliyor",
                "processing": "Hazırlanıyor",
                "shipping": "Yolda",
                "completed": "Teslim Edildi",
                "cancelled": "İptal Edildi"
            }
            
            status = status_mapping.get(order.get("status", "waiting"), "Bekliyor")
            
            status_color = {
                "Bekliyor": "status-waiting",
                "Hazırlanıyor": "status-preparing",
                "Yolda": "status-shipping",
                "Teslim Edildi": "status-delivered",
                "İptal Edildi": "status-canceled"
            }.get(status, "status-waiting")
            
            # Sipariş tarihini biçimlendir
            order_date = order.get("created_at", datetime.datetime.now())
            if isinstance(order_date, str):
                try:
                    order_date = datetime.datetime.fromisoformat(order_date.replace("Z", "+00:00"))
                except:
                    order_date = datetime.datetime.now()
            formatted_date = order_date.strftime("%d.%m.%Y %H:%M")
            
            # Konum bilgilerini al
            location = order.get("location", {})
            address = location.get("address", order.get("address", ""))
            
            # Ürün bilgilerini al
            request_data = order.get("request", {})
            product_name = request_data.get("product_name", order.get("product_name", "Su"))
            quantity = request_data.get("quantity", order.get("quantity", 1))
            
            # Teslim zamanları
            ready_time = order.get("ready_time", "")
            due_time = order.get("due_date", "")
            
            # Sipariş kartını oluştur
            col1, col2 = st.columns([4, 1])
            
            with col1:
                st.markdown(f"""
                <div class='order-card'>
                    <div class='order-header'>
                        <div class='order-id'>{order.get("order_id", "")}</div>
                        <div class='order-status {status_color}'>{status}</div>
                    </div>
                    <div class='order-details'>
                        <div>Ürün: {product_name}</div>
                        <div>Miktar: {quantity}</div>
                        <div>Toplam: ₺{order.get("total_price", 0):.2f}</div>
                        <div>Tarih: {formatted_date}</div>
                    </div>
                    <div class='order-address'>
                        <strong>Teslimat:</strong> {address}
                    </div>
                    <div class='order-times'>
                        <strong>Hazır Olma:</strong> {ready_time} &nbsp; | &nbsp;
                        <strong>Teslim:</strong> {due_time}
                    </div>
                </div>
                """, unsafe_allow_html=True)
            
            with col2:
                if st.button("Detaylar", key=f"btn_details_{order.get('order_id')}", use_container_width=True):
                    st.session_state.selected_order = order
                    
        st.markdown("</div>", unsafe_allow_html=True)
        
        # Seçilen sipariş detaylarını göster
        if st.session_state.selected_order:
            order = st.session_state.selected_order
            
            with st.expander("Sipariş Detayları", expanded=True):
                col1, col2 = st.columns([1, 1])
                
                with col1:
                    st.subheader("Sipariş Bilgileri")
                    st.write(f"**Sipariş ID:** {order.get('order_id')}")
                    st.write(f"**Müşteri ID:** {order.get('customer_id')}")
                    st.write(f"**Görev ID:** {order.get('task_id')}")
                    st.write(f"**Durum:** {status_mapping.get(order.get('status'), 'Bilinmiyor')}")
                    st.write(f"**Sipariş Tarihi:** {formatted_date}")
                    
                    request_data = order.get("request", {})
                    st.write(f"**Ürün:** {request_data.get('product_name', order.get('product_name', 'Su'))}")
                    st.write(f"**Miktar:** {request_data.get('quantity', order.get('quantity', 1))}")
                    st.write(f"**Talep (Litre):** {request_data.get('demand', 12.0)}")
                    
                with col2:
                    st.subheader("Teslimat Bilgileri")
                    location = order.get("location", {})
                    st.write(f"**Adres:** {location.get('address', order.get('address', ''))}")
                    st.write(f"**Enlem:** {location.get('latitude', 0.0)}")
                    st.write(f"**Boylam:** {location.get('longitude', 0.0)}")
                    st.write(f"**Hazır Olma Saati:** {order.get('ready_time', '')}")
                    st.write(f"**Teslim Saati:** {order.get('due_date', '')}")
                    st.write(f"**Servis Süresi:** {order.get('service_time', 5)} dakika")
                    
                    # Atama bilgileri
                    st.subheader("Atama Bilgileri")
                    st.write(f"**Atanan Araç:** {order.get('assigned_vehicle') or 'Henüz atama yapılmadı'}")
                    st.write(f"**Atanan Rota:** {order.get('assigned_route_id') or 'Henüz atama yapılmadı'}")
                
                # Sipariş geçmişini göster
                st.subheader("Sipariş Geçmişi")
                
                # Sipariş durumunu güncelleme - sadece iptal etme seçeneği
                if order.get("status") == "waiting":  # Sadece bekleyen siparişler için
                    col1, col2 = st.columns(2)
                    with col1:
                        cancel_button = st.button("🚫 Siparişi İptal Et", use_container_width=True)
                    
                    if cancel_button:
                        if update_order_status(order.get("order_id"), "cancelled", st.session_state.user["user_id"]):
                            st.success("Sipariş başarıyla iptal edildi!")
                            # Siparişi yeniden yükle
                            updated_orders = get_user_orders(st.session_state.user["user_id"])
                            for updated_order in updated_orders:
                                if updated_order.get("order_id") == order.get("order_id"):
                                    st.session_state.selected_order = updated_order
                                    st.rerun()
                        else:
                            st.error("Sipariş iptal edilirken bir hata oluştu!")
                elif order.get("status") == "cancelled":
                    st.warning("Bu sipariş iptal edilmiş.")
                elif order.get("status") == "completed":
                    st.success("Bu sipariş tamamlanmış.")
                else:
                    st.info(f"Sipariş durumu: {status_mapping.get(order.get('status'), 'Bilinmiyor')}")
                
                # Sipariş geçmişini göster
                order_history = get_order_history(order_id=order.get("order_id"))
                
                if order_history:
                    history_table = []
                    
                    for entry in order_history:
                        action_time = entry.get("action_time", datetime.datetime.now())
                        if isinstance(action_time, str):
                            try:
                                action_time = datetime.datetime.fromisoformat(action_time.replace("Z", "+00:00"))
                            except:
                                action_time = datetime.datetime.now()
                        
                        history_table.append({
                            "Tarih": action_time.strftime("%d.%m.%Y %H:%M"),
                            "Durum": status_mapping.get(entry.get("status"), entry.get("status", "")),
                            "İşlem": entry.get("action", ""),
                            "İşlemi Yapan": entry.get("action_by", "")
                        })
                    
                    st.table(history_table)
                else:
                    st.info("Bu sipariş için geçmiş bulunamadı.")
            
            # Geri dönüş butonu
            if st.button("Ana Sayfaya Dön"):
                navigate_to("dashboard")
                st.rerun()
