from copy import deepcopy

from werkzeug.security import check_password_hash


def verify_password(plain_password, stored_password):
    """
    Verify password with backward compatibility for legacy plaintext records.
    """
    if not plain_password or not stored_password:
        return False

    try:
        if isinstance(stored_password, str) and (
            stored_password.startswith("pbkdf2:")
            or stored_password.startswith("scrypt:")
        ):
            return check_password_hash(stored_password, plain_password)
    except Exception:
        return plain_password == stored_password

    return plain_password == stored_password


def authenticate_user(db, user_id_or_email, password):
    """Authenticate by user_id or email and return sanitized user document."""
    user = db.Users.find_one(
        {
            "$or": [
                {"user_id": user_id_or_email},
                {"email": user_id_or_email},
            ]
        }
    )

    if user is None:
        return None
    if not verify_password(password, user.get("password")):
        return None

    sanitized = deepcopy(user)
    if "_id" in sanitized:
        sanitized["_id"] = str(sanitized["_id"])
    sanitized.pop("password", None)
    return sanitized

