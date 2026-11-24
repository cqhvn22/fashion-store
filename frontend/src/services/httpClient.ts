import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '../types/models';
export const mockMode = import.meta.env.VITE_ENABLE_MOCK !== 'false';
export const useDbAuth = import.meta.env.VITE_USE_DB_AUTH === 'true' || !mockMode;
export const useDbCatalog = import.meta.env.VITE_USE_DB_CATALOG === 'true' || !mockMode;
export const useDbOrders = import.meta.env.VITE_USE_DB_ORDERS === 'true' || !mockMode;
export const useDbAi = import.meta.env.VITE_USE_DB_AI === 'true' || !mockMode;
const legacyAccessKey = 'fashionhub_access_token';
const refreshKey = 'fashionhub_refresh_token';
const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';
let accessToken: string | null = null;
export function hasAccessToken() { return accessToken !== null; }
export function currentAccessToken() { return accessToken; }
export function saveTokens(nextAccessToken: string, refreshToken: string) {
  accessToken = nextAccessToken;
  localStorage.setItem(refreshKey, refreshToken);
}
export function clearTokens() {
  accessToken = null;
  sessionStorage.removeItem(legacyAccessKey);
  localStorage.removeItem(refreshKey);
}
export function savedRefreshToken() { return localStorage.getItem(refreshKey); }
let refreshPromise: Promise<string> | null = null;
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios.post<{ data: { accessToken: string; refreshToken: string } }>(
      `${baseURL}/auth/refresh`, { refreshToken: savedRefreshToken() },
      { timeout: 12000 },
    ).then(({ data }) => {
      saveTokens(data.data.accessToken, data.data.refreshToken);
      return data.data.accessToken;
    }).catch((error) => {
      clearTokens();
      window.dispatchEvent(new Event('fashionhub-auth-expired'));
      throw error;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
export const httpClient = axios.create({
  baseURL,
  timeout: 12000,
});
httpClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});
httpClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
      if (error.response?.status === 401 && !original?.url?.startsWith('/auth/')) {
        if (original && !original._retry && savedRefreshToken()) {
          original._retry = true;
          try {
            const token = await refreshAccessToken();
            original.headers.Authorization = `Bearer ${token}`;
            return httpClient(original);
          } catch { /* The failed refresh is handled below. */ }
        }
        clearTokens();
        window.dispatchEvent(new Event('fashionhub-auth-expired'));
        return Promise.reject(new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'));
      }
      const data = error.response?.data as (Partial<ApiError> & { detail?: string }) | undefined;
      return Promise.reject(
        new Error(
          data?.message ?? data?.detail ??
            (error.response?.status === 403
              ? 'Bạn không có quyền thực hiện thao tác này.'
              : 'Không thể kết nối máy chủ. Vui lòng thử lại.'),
        ),
      );
    }
    return Promise.reject(error);
  },
);
