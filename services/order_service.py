import datetime
from copy import deepcopy

from services.common import STATUS_MAP_TR_TO_EN, serialize_order_document, to_time_string


def get_product_list(db):
    return list(db.Products.find({}, {"_id": 0}))


def get_product_by_id(db, product_id):
    return db.Products.find_one({"product_id": product_id}, {"_id": 0})


def save_order(db, order_data):
    """
    Persist order after normalizing datetime/time fields.
    """
    payload = deepcopy(order_data)
    now = datetime.datetime.now(datetime.timezone.utc)

    payload.update(
        {
            "created_at": now,
            "updated_at": now,
            "order_date": now,
            "ready_time": to_time_string(payload.get("ready_time")),
            "due_date": to_time_string(payload.get("due_date")),
        }
    )

    result = db.Orders.insert_one(payload)
    return result.acknowledged


def get_user_orders(db, user_id, status=None, start_date=None, end_date=None):
    query = {"customer_id": user_id}

    if status and status.lower() != "tümü":
        normalized = status.lower()
        query["status"] = STATUS_MAP_TR_TO_EN.get(normalized, normalized)

    date_filter = {}
    if start_date:
        date_filter["$gte"] = datetime.datetime.combine(
            start_date, datetime.time.min, tzinfo=datetime.timezone.utc
        )
    if end_date:
        date_filter["$lte"] = datetime.datetime.combine(
            end_date, datetime.time.max, tzinfo=datetime.timezone.utc
        )
    if date_filter:
        query["order_date"] = date_filter

    orders = list(db.Orders.find(query).sort("created_at", -1))
    return [serialize_order_document(order) for order in orders]


def get_order_count_by_status(db, user_id):
    total = db.Orders.count_documents({"customer_id": user_id})
    waiting = db.Orders.count_documents(
        {"customer_id": user_id, "status": {"$in": ["waiting", "processing", "shipping"]}}
    )
    completed = db.Orders.count_documents({"customer_id": user_id, "status": "completed"})
    return {"total": total, "waiting": waiting, "completed": completed}


def get_order_history(db, order_id=None, customer_id=None):
    query = {}
    if order_id:
        query["order_id"] = order_id
    if customer_id:
        query["customer_id"] = customer_id

    history = list(db.OrderHistory.find(query).sort("action_time", -1))
    for entry in history:
        if "_id" in entry:
            entry["_id"] = str(entry["_id"])
    return history


def update_order_status(db, order_id, new_status, updated_by):
    now = datetime.datetime.now()
    order_result = db.Orders.update_one(
        {"order_id": order_id},
        {
            "$set": {
                "status": new_status,
                "updated_at": now,
                "change_log": {
                    "field": "status",
                    "old_value": None,
                    "new_value": new_status,
                    "changed_at": now,
                    "changed_by": updated_by,
                },
            }
        },
    )
    return order_result.modified_count > 0


def get_all_orders(db):
    return list(db.Orders.find({}, {"_id": 0}).sort("created_at", -1))


def get_active_orders(db):
    return list(
        db.Orders.find(
            {"status": {"$in": ["waiting", "processing", "shipping"]}},
            {"_id": 0},
        ).sort("created_at", -1)
    )

