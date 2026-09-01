import axios from "axios";
import { getToken, clearToken } from "./auth";

const normalizeApiUrl = (value) => {
  if (!value) return "http://localhost:8080/api/v1";
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.includes("/api/v1") ? trimmed : `${trimmed}/api/v1`;
};

const API_URL = normalizeApiUrl(
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:8080"
);

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();

  if (token && !config.url?.includes("/otp/")) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== "/signin") {
        window.location.href = "/signin";
      }
    }
    return Promise.reject(error);
  }
);

export const userAxios = apiClient;
export const otpAxios = apiClient;
export const accountAxios = apiClient;
export const transactionsAxios = apiClient;
export const requestsAxios = apiClient;
export default apiClient;
