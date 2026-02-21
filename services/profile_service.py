import datetime
from copy import deepcopy

from werkzeug.security import generate_password_hash


def update_user_profile(db, user_id, update_data):
    payload = deepcopy(update_data)

    if "password" in payload and payload["password"]:
        payload["password"] = generate_password_hash(payload["password"])
    if "password" in payload and not payload["password"]:
        del payload["password"]

    payload["updated_at"] = datetime.datetime.now()

    result = db.Users.update_one({"user_id": user_id}, {"$set": payload})
    if result.matched_count == 0:
        return False, "Kullanıcı bulunamadı"

    updated_user = db.Users.find_one({"user_id": user_id})
    if updated_user and "_id" in updated_user:
        updated_user["_id"] = str(updated_user["_id"])
    if updated_user:
        updated_user.pop("password", None)
    return True, updated_user


def get_all_users(db):
    return list(db.Users.find({}, {"_id": 0, "password": 0}).sort("user_id", 1))


def get_user_profile(db, user_id):
    user = db.Users.find_one({"user_id": user_id})
    if user is None:
        return None
    if "_id" in user:
        user["_id"] = str(user["_id"])
    user.pop("password", None)
    return user
