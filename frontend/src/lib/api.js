import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ciq_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gracefully handle an expired / invalid session instead of surfacing a raw
// 401/403 (which the React dev overlay shows as an "uncaught runtime error").
// Auth attempts (login/register) and the silent /auth/me probe are excluded so
// their own callers can handle the response.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const isAuthFlow =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/me");

    if ((status === 401 || status === 403) && !isAuthFlow) {
      localStorage.removeItem("ciq_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
        // Halt the promise chain so no component throws on the stale request.
        return new Promise(() => {});
      }
    }
    return Promise.reject(error);
  }
);

export const STREAM_URL = `${API_BASE}/chat/stream`;
