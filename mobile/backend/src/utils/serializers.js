function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "";
  return String(value);
}

function toTimeString(value) {
  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  if (value == null) return "";
  return String(value);
}

function sanitizeUser(user) {
  if (!user) return null;
  const copy = { ...user };
  if (copy._id) copy._id = String(copy._id);
  delete copy.password;
  delete copy.password_hash;
  return copy;
}

function serializeOrder(order) {
  const copy = { ...order };
  if (copy._id) copy._id = String(copy._id);
  if ("created_at" in copy) copy.created_at = toIso(copy.created_at);
  if ("updated_at" in copy) copy.updated_at = toIso(copy.updated_at);
  if ("order_date" in copy) copy.order_date = toIso(copy.order_date);
  if ("ready_time" in copy) copy.ready_time = toTimeString(copy.ready_time);
  if ("due_date" in copy) copy.due_date = toTimeString(copy.due_date);
  return copy;
}

module.exports = {
  sanitizeUser,
  serializeOrder,
  toTimeString,
};
