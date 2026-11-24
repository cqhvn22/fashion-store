import { afterEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { clearTokens, hasAccessToken, httpClient, refreshAccessToken, saveTokens } from '../services/httpClient';

const originalAdapter = httpClient.defaults.adapter;

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  clearTokens();
  localStorage.clear();
  sessionStorage.clear();
});

describe('xác thực bằng JWT Bearer', () => {
  it('gửi access token trong Authorization mà không lưu vào sessionStorage hoặc gửi cookie', async () => {
    saveTokens('test-jwt', 'test-refresh-token');
    httpClient.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBe('Bearer test-jwt');
      expect(config.withCredentials).not.toBe(true);
      return { data: {}, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
    };

    await httpClient.get('/users/me');
    expect(hasAccessToken()).toBe(true);
    expect(sessionStorage.getItem('fashionhub_access_token')).toBeNull();
  });

  it('khôi phục access token từ refresh token khi trang được tải lại', async () => {
    localStorage.setItem('fashionhub_refresh_token', 'persistent-refresh-token');
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { data: { accessToken: 'renewed-jwt', refreshToken: 'rotated-refresh-token' } },
    });
    httpClient.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBe('Bearer renewed-jwt');
      return { data: {}, status: 200, statusText: 'OK', headers: new AxiosHeaders(), config };
    };

    await refreshAccessToken();
    await httpClient.get('/users/me');

    expect(refresh).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      { refreshToken: 'persistent-refresh-token' },
      { timeout: 12000 },
    );
    expect(localStorage.getItem('fashionhub_refresh_token')).toBe('rotated-refresh-token');
  });

  it('xóa token và báo hết hạn đăng nhập khi API trả 401 mà không có refresh token', async () => {
    saveTokens('expired-token', 'test-refresh-token');
    localStorage.removeItem('fashionhub_refresh_token');
    const ended = vi.fn();
    window.addEventListener('fashionhub-auth-expired', ended, { once: true });
    httpClient.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        data: { detail: 'Invalid token' }, status: 401, statusText: 'Unauthorized',
        headers: new AxiosHeaders(), config,
      });
    };

    await expect(httpClient.get('/admin/ai/index-status'))
      .rejects.toThrow('Phiên đăng nhập đã hết hạn');
    expect(hasAccessToken()).toBe(false);
    expect(ended).toHaveBeenCalledOnce();
  });
});
