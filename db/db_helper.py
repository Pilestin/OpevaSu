from pymongo import MongoClient
import logging
from dotenv import load_dotenv
import os
import datetime
import streamlit as st

# .env dosyasını yükle
load_dotenv()
# MongoDB bağlantı bilgilerini al
MONGO_URI = os.getenv("MONGO_URI")
if MONGO_URI is None:
    raise ValueError("MONGO_URI ortam değişkeni tanımlı değil.")

# Loglama yapılandırması
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@st.cache_resource
def get_db_connection():
    """MongoDB bağlantısını döndürür."""
    client = MongoClient(MONGO_URI)
    return client["RouteManagementDB"]

def connect_to_mongodb():
    """MongoDB'ye bağlantı kurar ve veritabanı nesnesini döndürür."""
    try:
        return get_db_connection()
    except Exception as e:
        logger.error(f"MongoDB bağlantı hatası: {e}")
        return None

def authenticate_user(userID_or_email, password):
    """
    Kullanıcıyı doğrular ve kullanıcı bilgilerini döndürür.
    userID_or_email: Kullanıcı ID veya email adresi
    password: Kullanıcı şifresi
    """
    print(f"userID_or_email: {userID_or_email}, password: {password}")  # Debugging line
    try:
        db = connect_to_mongodb()
        if db is None:  # Changed from "if not db:" to "if db is None:"
            print("Veritabanı bağlantısı sağlanamadı.")
            return None
        
        # Kullanıcıyı ID veya email ile ara
        user = db.Users.find_one({
            "$or": [
                {"user_id": userID_or_email},
                {"email": userID_or_email}
            ]
        })
        
        if user is not None:  # Changed from "if user:" to "if user is not None:"
            # Şifre kontrolü başarılı, tüm kullanıcı bilgilerini döndür
            # MongoDB _id objesi JSON dönüşümünde sorun yaratabilir, string'e çevirelim
            if '_id' in user:
                user['_id'] = str(user['_id'])
            return user
        return None
    except Exception as e:
        logger.error(f"Kimlik doğrulama hatası: {e}")
        return None

@st.cache_data(ttl=300)  # 5 dakika cache
def get_product_list():
    """Ürün listesini döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        
        products = list(db.Products.find({}, {'_id': 0}))
        return products
    except Exception as e:
        logger.error(f"Ürün listesi alma hatası: {e}")
        return []

@st.cache_data(ttl=300)
def get_product_by_id(product_id):
    """ID'ye göre ürün bilgisini döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return None
        
        product = db.Products.find_one({"product_id": product_id}, {'_id': 0})
        return product
    except Exception as e:
        logger.error(f"Ürün bilgisi alma hatası: {e}")
        return None

def save_order(order_data):
    """Siparişi Orders koleksiyonuna kaydeder."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return False
        
        # Orders koleksiyonuna ekle
        result = db.Orders.insert_one(order_data)
        return result.acknowledged
        
    except Exception as e:
        logger.error(f"Sipariş kaydetme hatası: {e}")
        return False

def get_user_orders(user_id, status=None, start_date=None, end_date=None):
    """Kullanıcının siparişlerini döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        
        # Filtreleme kriterleri
        query = {"customer_id": user_id}  # customer_id ile sorgu yap
        
        # Durum filtresi
        if status and status.lower() != "tümü":
            status_map = {
                "bekliyor": "waiting",
                "hazırlanıyor": "processing",
                "yolda": "shipping",
                "teslim edildi": "completed",
                "iptal edildi": "cancelled"
            }
            query["status"] = status_map.get(status.lower(), status.lower())
        
        # Tarih filtresi
        date_filter = {}
        if start_date:
            date_filter["$gte"] = datetime.datetime.combine(start_date, datetime.time.min)
        if end_date:
            date_filter["$lte"] = datetime.datetime.combine(end_date, datetime.time.max)
        
        if date_filter:
            query["created_at"] = date_filter
        
        # Siparişleri al ve _id alanını string'e çevir
        orders = list(db.Orders.find(query).sort("created_at", -1))
        for order in orders:
            if '_id' in order:
                order['_id'] = str(order['_id'])
        
        return orders
    except Exception as e:
        logger.error(f"Sipariş listesi alma hatası: {e}")
        return []

def get_order_count_by_status(user_id):
    """Kullanıcının sipariş sayılarını durumlara göre döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return {"total": -1, "waiting": -1, "completed": -1}
        
        # Toplam sipariş sayısı
        total = db.Orders.count_documents({"customer_id": user_id})
        
        # Bekleyen sipariş sayısı (waiting, processing, shipping)
        waiting = db.Orders.count_documents({
            "customer_id": user_id, 
            "status": {"$in": ["waiting", "processing", "shipping"]}
        })
        
        # Tamamlanmış sipariş sayısı
        completed = db.Orders.count_documents({
            "customer_id": user_id, 
            "status": "completed"
        })
        
        return {
            "total": total,
            "waiting": waiting,
            "completed": completed
        }
    except Exception as e:
        logger.error(f"Sipariş sayısı alma hatası: {e}")
        return {"total": 0, "waiting": 0, "completed": 0}

def get_order_history(order_id=None, customer_id=None):
    """Sipariş geçmişini döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        
        # Filtreleme kriterleri
        query = {}
        
        if order_id:
            query["order_id"] = order_id
        
        if customer_id:
            query["customer_id"] = customer_id
        
        # Geçmiş kayıtları al ve _id alanını string'e çevir
        history = list(db.OrderHistory.find(query).sort("action_time", -1))
        for entry in history:
            if '_id' in entry:
                entry['_id'] = str(entry['_id'])
        
        return history
    except Exception as e:
        logger.error(f"Sipariş geçmişi alma hatası: {e}")
        return []

def update_order_status(order_id, new_status, updated_by):
    """Sipariş durumunu günceller."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return False
        
        # Orders koleksiyonundaki durumu güncelle
        now = datetime.datetime.now()
        order_result = db.Orders.update_one(
            {"order_id": order_id},
            {"$set": {
                "status": new_status,
                "updated_at": now,
                "change_log": {
                    "field": "status",
                    "old_value": None,  # Eski değeri almak için ekstra sorgu gerekir
                    "new_value": new_status,
                    "changed_at": now,
                    "changed_by": updated_by
                }
            }}
        )
        
        return order_result.modified_count > 0
    except Exception as e:
        logger.error(f"Sipariş durumu güncelleme hatası: {e}")
        return False

def update_user_profile(user_id, update_data):
    """
    Kullanıcı profilini günceller
    user_id: Güncellenecek kullanıcının ID'si
    update_data: Güncellenecek alanlar ve değerleri
    """
    try:
        db = connect_to_mongodb()
        if db is None:
            return False, "Veritabanına bağlanılamadı"
        
        # Şifre değişikliği kontrolü
        if "password" in update_data and update_data["password"]:
            from werkzeug.security import generate_password_hash
            update_data["password"] = generate_password_hash(update_data["password"])
        
        # Eğer şifre boşsa, şifre alanını güncelleme listesinden çıkar
        if "password" in update_data and not update_data["password"]:
            del update_data["password"]
        
        # Güncelleme tarihini ekle
        update_data["updated_at"] = datetime.datetime.now()
        
        # Kullanıcıyı güncelle
        result = db.Users.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            return False, "Kullanıcı bulunamadı"
        
        # Güncellenen kullanıcı bilgilerini al
        updated_user = db.Users.find_one({"user_id": user_id})
        if updated_user and "_id" in updated_user:
            updated_user["_id"] = str(updated_user["_id"])
        
        return True, updated_user
    except Exception as e:
        logger.error(f"Kullanıcı güncelleme hatası: {e}")
        return False, f"Güncelleme sırasında hata: {e}"

@st.cache_data(ttl=60)  # 1 dakika cache
def get_all_users():
    """Tüm kullanıcıları döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        
        users = list(db.Users.find({}, {'_id': 0, 'password': 0}))
        return users
    except Exception as e:
        logger.error(f"Kullanıcı listesi alma hatası: {e}")
        return []

def get_all_orders():
    """Tüm siparişleri döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        
        orders = list(db.Orders.find({}, {'_id': 0}).sort("created_at", -1))
        return orders
    except Exception as e:
        logger.error(f"Sipariş listesi alma hatası: {e}")
        return []

def get_active_orders():
    """Aktif siparişleri döndürür."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        
        # Aktif siparişleri orders koleksiyonundan al
        active_orders = list(db.Orders.find(
            {"status": {"$in": ["waiting", "processing", "shipping"]}},
            {'_id': 0}
        ).sort("created_at", -1))
        return active_orders
    except Exception as e:
        logger.error(f"Aktif sipariş listesi alma hatası: {e}")
        return []
