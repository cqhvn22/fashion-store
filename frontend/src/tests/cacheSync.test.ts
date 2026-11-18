import type { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupGlobalSync } from '../services/sync';

afterEach(() => vi.useRealTimers());

describe('đồng bộ cache giữa các tab', () => {
  it('không bỏ sót hai thay đổi đến trong cùng khoảng debounce', () => {
    vi.useFakeTimers();
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const stop = setupGlobalSync({ invalidateQueries } as unknown as QueryClient);
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'fashionhub_banners' }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'fashionhub_home_categories' }));
      vi.advanceTimersByTime(100);

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['banners'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['home-categories'] });
    } finally {
      stop();
    }
  });
});
