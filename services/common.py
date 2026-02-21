import datetime
from copy import deepcopy


STATUS_MAP_TR_TO_EN = {
    "bekliyor": "waiting",
    "hazirlaniyor": "processing",
    "hazırlanıyor": "processing",
    "yolda": "shipping",
    "teslim edildi": "completed",
    "iptal edildi": "cancelled",
}


def to_iso8601(value):
    """Safely convert datetime-like values to ISO8601 string."""
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if value is None:
        return ""
    return str(value)


def to_time_string(value):
    """Safely convert time-like values to HH:MM string."""
    if isinstance(value, datetime.datetime):
        return value.strftime("%H:%M")
    if isinstance(value, datetime.time):
        return value.strftime("%H:%M")
    if value is None:
        return ""
    return str(value)


def serialize_order_document(order):
    """Return a shallow-serialized copy safe for Streamlit rendering."""
    serialized = deepcopy(order)
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
    if "created_at" in serialized:
        serialized["created_at"] = to_iso8601(serialized["created_at"])
    if "updated_at" in serialized:
        serialized["updated_at"] = to_iso8601(serialized["updated_at"])
    if "order_date" in serialized:
        serialized["order_date"] = to_iso8601(serialized["order_date"])
    if "ready_time" in serialized:
        serialized["ready_time"] = to_time_string(serialized["ready_time"])
    if "due_date" in serialized:
        serialized["due_date"] = to_time_string(serialized["due_date"])
    return serialized

