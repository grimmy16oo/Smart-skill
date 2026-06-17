const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000/api";

const TOKEN_KEY = "skillswap_token";

/* ================= TOKEN ================= */

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/* ================= USER ================= */

export function normalizeUser(user) {
  if (!user) return null;

  const uid = user.uid || user.id || user._id;

  return {
    ...user,
    id: uid,
    uid,
    displayName: user.displayName || user.name,
  };
}

/* ================= API ================= */

export async function apiRequest(path, options = {}) {
  const token = getToken();

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(options.headers || {}),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Could not reach the API at ${API_URL}. Make sure the backend server is running and CORS allows this frontend URL.`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;

    if (response.status === 401) {
      clearToken();
    }

    throw error;
  }

  return data;
}
