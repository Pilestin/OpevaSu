import datetime

def format_datetime(dt):
    """Datetime nesnesini kullanıcı dostu formata dönüştürür."""
    if isinstance(dt, str):
        dt = datetime.datetime.fromisoformat(dt.replace("Z", "+00:00"))
    return dt.strftime("%d.%m.%Y %H:%M")

def format_currency(amount):
    """Para miktarını Türk Lirası formatına dönüştürür."""
    return f"₺{float(amount):.2f}"

def get_status_turkish(status):
    """Sipariş durumunu Türkçe'ye çevirir."""
    status_mapping = {
        "waiting": "Bekliyor",
        "processing": "Hazırlanıyor",
        "shipping": "Yolda",
        "completed": "Teslim Edildi",
        "cancelled": "İptal Edildi"
    }
    return status_mapping.get(status, "Bekliyor")

def get_status_color(status):
    """Sipariş durumuna göre CSS class adını döndürür."""
    status_color = {
        "Bekliyor": "status-waiting",
        "Hazırlanıyor": "status-preparing",
        "Yolda": "status-shipping",
        "Teslim Edildi": "status-delivered",
        "İptal Edildi": "status-canceled"
    }
    return status_color.get(status, "status-waiting")
