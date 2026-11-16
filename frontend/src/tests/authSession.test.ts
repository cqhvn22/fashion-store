import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { httpClient } from '../services/httpClient';

const originalAdapter = httpClient.defaults.adapter;

afterEach(() => {
  httpClient.defaults.adapter = originalAdapter;
  localStorage.clear();
  sessionStorage.clear();
});

describe('phiên đăng nhập hết hạn', () => {
  it('xóa token và báo kết thúc phiên khi AI API trả 401 mà không có refresh token', async () => {
    sessionStorage.setItem('fashionhub_access_token', 'expired-token');
    const ended = vi.fn();
    window.addEventListener('fashionhub-session-ended', ended, { once: true });
    httpClient.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        data: { detail: 'Invalid token' }, status: 401, statusText: 'Unauthorized',
        headers: new AxiosHeaders(), config,
      });
    };

    await expect(httpClient.get('/admin/ai/index-status'))
      .rejects.toThrow('Phiên đăng nhập đã hết hạn');
    expect(sessionStorage.getItem('fashionhub_access_token')).toBeNull();
    expect(ended).toHaveBeenCalledOnce();
  });
});
