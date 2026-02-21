function resolveApiBaseUrl(rawValue) {
  const trimmed = typeof rawValue === "string" ? rawValue.trim().replace(/^['"]|['"]$/g, "") : "";
  if (!trimmed) {
    return { value: "", error: "API adresi bulunamadi. EXPO_PUBLIC_API_BASE_URL ayarlanmali." };
  }

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^https?:/i.test(trimmed)
      ? trimmed.replace(/^https?:/i, (match) => `${match}//`)
      : trimmed;

  const normalized = withScheme.replace(/\/+$/, "");
  const isValid = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(normalized);
  if (!isValid) {
    return {
      value: "",
      error: `API adresi gecersiz: "${trimmed}". Ornek: http://157.230.17.89:3003`,
    };
  }

  return { value: normalized, error: "" };
}

const API_BASE_URL_RESOLUTION = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

async function request(path, options = {}) {
  if (API_BASE_URL_RESOLUTION.error) {
    throw new Error(API_BASE_URL_RESOLUTION.error);
  }

  const url = `${API_BASE_URL_RESOLUTION.value}${path}`;
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`Sunucuya baglanilamadi: ${url} (${error?.message || "Network request failed"})`);
  }
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof body === "object" && body?.detail ? body.detail : "Beklenmeyen API hatasi";
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  return body;
}

export const authApi = {
  login: ({ userIdOrEmail, password }) => {
    const payload = { user_id_or_email: userIdOrEmail };
    if (password) {
      payload.password = password;
    }

    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};

export const ordersApi = {
  list: ({ token, status, collection, userId }) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (collection) params.set("collection", collection);
    if (userId) params.set("user_id", userId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return request(`/orders${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  create: ({ token, order }) =>
    request("/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order }),
    }),
  update: ({ token, orderId, updates }) =>
    request(`/orders/${encodeURIComponent(orderId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ updates }),
    }),
  remove: ({ token, orderId }) =>
    request(`/orders/${encodeURIComponent(orderId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export const productsApi = {
  list: ({ token }) =>
    request("/products", {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export const usersApi = {
  list: ({ token }) =>
    request("/users", {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

export const profileApi = {
  get: ({ token, userId }) =>
    request(`/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  update: ({ token, userId, updates }) =>
    request(`/profile/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ updates }),
    }),
};
