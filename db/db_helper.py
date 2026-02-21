import logging
import os

import streamlit as st
from dotenv import load_dotenv
from pymongo import MongoClient

from services import auth_service, order_service, profile_service


load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if MONGO_URI is None:
    raise ValueError("MONGO_URI ortam değişkeni tanımlı değil.")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@st.cache_resource
def get_db_connection():
    """Return MongoDB database connection."""
    client = MongoClient(MONGO_URI)
    return client["RouteManagementDB"]


def connect_to_mongodb():
    """Return database handle or None when connection fails."""
    try:
        return get_db_connection()
    except Exception as exc:
        logger.error(f"MongoDB bağlantı hatası: {exc}")
        return None


def authenticate_user(userID_or_email, password):
    """Authenticate and return user document."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return None
        return auth_service.authenticate_user(db, userID_or_email, password)
    except Exception as exc:
        logger.error(f"Kimlik doğrulama hatası: {exc}")
        return None


@st.cache_data(ttl=300)
def get_product_list():
    """Return product list."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        return order_service.get_product_list(db)
    except Exception as exc:
        logger.error(f"Ürün listesi alma hatası: {exc}")
        return []


@st.cache_data(ttl=300)
def get_product_by_id(product_id):
    """Return product by ID."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return None
        return order_service.get_product_by_id(db, product_id)
    except Exception as exc:
        logger.error(f"Ürün bilgisi alma hatası: {exc}")
        return None


def save_order(order_data):
    """Save order to Orders collection."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return False
        return order_service.save_order(db, order_data)
    except Exception as exc:
        logger.error(f"Sipariş kaydetme hatası: {exc}")
        logger.error(f"Order data: {order_data}")
        return False


def get_user_orders(user_id, status=None, start_date=None, end_date=None):
    """Return user orders."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        return order_service.get_user_orders(db, user_id, status, start_date, end_date)
    except Exception as exc:
        logger.error(f"Sipariş listesi alma hatası: {exc}")
        return []


def get_order_count_by_status(user_id):
    """Return order counts grouped by status."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return {"total": -1, "waiting": -1, "completed": -1}
        return order_service.get_order_count_by_status(db, user_id)
    except Exception as exc:
        logger.error(f"Sipariş sayısı alma hatası: {exc}")
        return {"total": 0, "waiting": 0, "completed": 0}


def get_order_history(order_id=None, customer_id=None):
    """Return order history records."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        return order_service.get_order_history(db, order_id=order_id, customer_id=customer_id)
    except Exception as exc:
        logger.error(f"Sipariş geçmişi alma hatası: {exc}")
        return []


def update_order_status(order_id, new_status, updated_by):
    """Update order status."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return False
        return order_service.update_order_status(db, order_id, new_status, updated_by)
    except Exception as exc:
        logger.error(f"Sipariş durumu güncelleme hatası: {exc}")
        return False


def update_user_profile(user_id, update_data):
    """Update profile data."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return False, "Veritabanına bağlanılamadı"
        return profile_service.update_user_profile(db, user_id, update_data)
    except Exception as exc:
        logger.error(f"Kullanıcı güncelleme hatası: {exc}")
        return False, f"Güncelleme sırasında hata: {exc}"


@st.cache_data(ttl=60)
def get_all_users():
    """Return all users."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        return profile_service.get_all_users(db)
    except Exception as exc:
        logger.error(f"Kullanıcı listesi alma hatası: {exc}")
        return []


def get_all_orders():
    """Return all orders."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        return order_service.get_all_orders(db)
    except Exception as exc:
        logger.error(f"Sipariş listesi alma hatası: {exc}")
        return []


def get_active_orders():
    """Return active orders."""
    try:
        db = connect_to_mongodb()
        if db is None:
            return []
        return order_service.get_active_orders(db)
    except Exception as exc:
        logger.error(f"Aktif sipariş listesi alma hatası: {exc}")
        return []

