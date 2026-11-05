import axios from 'axios';
import type { ApiError } from '../types/models';
export const mockMode = import.meta.env.VITE_ENABLE_MOCK !== 'false';
export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1',
  timeout: 12000,
  withCredentials: true,
});
httpClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('fashionhub_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) sessionStorage.removeItem('fashionhub_access_token');
      const data = error.response?.data as Partial<ApiError> | undefined;
      return Promise.reject(
        new Error(
          data?.message ??
            (error.response?.status === 403
              ? 'Bạn không có quyền thực hiện thao tác này.'
              : 'Không thể kết nối máy chủ. Vui lòng thử lại.'),
        ),
      );
    }
    return Promise.reject(error);
  },
);
