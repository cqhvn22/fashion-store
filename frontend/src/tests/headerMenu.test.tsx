import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../components/layout';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('menu danh mục', () => {
  it('đóng menu desktop sau khi chọn danh mục con', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={client}><Header /></QueryClientProvider>
      </MemoryRouter>,
    );
    const parent = await screen.findByRole('link', { name: /^Áo khoác$/ });
    const group = parent.closest('.nav-group');
    expect(group).not.toBeNull();
    fireEvent.mouseEnter(group!);
    const dropdown = group!.querySelector('.nav-dropdown');
    expect(dropdown).toHaveClass('lg:block');
    fireEvent.click(screen.getByRole('link', { name: 'Áo khoác gió' }));
    await waitFor(() => expect(group!.querySelector('.nav-dropdown')).toBeNull());
    expect(container.querySelector('#shop-navigation')).toHaveClass('hidden');
    client.clear();
  });

  it('đóng menu điện thoại sau khi chọn mục con', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}><Header /></QueryClientProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('link', { name: /^Áo khoác$/ });
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(screen.getByRole('button', { name: 'Đóng menu' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Mở danh mục Áo khoác' }));
    fireEvent.click(screen.getByRole('link', { name: 'Áo khoác gió' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mở menu' }))
      .toHaveAttribute('aria-expanded', 'false'));
    client.clear();
  });

  it('giữ menu mở với grace period khi di chuột từ menu cha xuống dropdown và cho phép chọn danh mục con', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}><Header /></QueryClientProvider>
      </MemoryRouter>,
    );
    const parent = await screen.findByRole('link', { name: /^Phụ kiện$/i });
    const group = parent.closest('.nav-group');
    expect(group).not.toBeNull();

    // 1. Rê chuột vào "Phụ kiện"
    fireEvent.mouseEnter(group!);
    const dropdown = group!.querySelector('.nav-dropdown');
    expect(dropdown).toHaveClass('lg:block');

    // 2. Di chuột xuống: rời group tạm thời nhưng grace period vẫn giữ menu mở
    fireEvent.mouseLeave(group!);
    expect(dropdown).toHaveClass('lg:block');

    // 3. Rê chuột vào dropdown con
    fireEvent.mouseEnter(dropdown!);
    expect(dropdown).toHaveClass('lg:block');

    // 4. Các danh mục con hiển thị đầy đủ
    const subLinks = dropdown!.querySelectorAll('a');
    expect(subLinks.length).toBeGreaterThan(0);

    // 5. Rời khỏi dropdown hoàn toàn
    fireEvent.mouseLeave(dropdown!);
    // Sau khi hết grace period (>300ms), menu sẽ tự động đóng
    await waitFor(() => expect(group!.querySelector('.nav-dropdown')).toBeNull(), { timeout: 1000 });

    client.clear();
  });

  it('chỉ lấy random thumbnail danh mục một lần và lưu vào localStorage, không tạo ảnh mới khi hover nhiều lần', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}><Header /></QueryClientProvider>
      </MemoryRouter>,
    );
    const parent = await screen.findByRole('link', { name: /^Quần$/i });
    const group = parent.closest('.nav-group');
    expect(group).not.toBeNull();

    // Rê chuột vào "Quần" lần đầu
    fireEvent.mouseEnter(group!);

    // Kiểm tra dữ liệu thumbnails đã được lưu vào localStorage
    const cacheKey = 'fashionhub_category_thumbnails_cache_v1';
    const rawCache = localStorage.getItem(cacheKey);
    expect(rawCache).not.toBeNull();
    const cache = JSON.parse(rawCache!);
    expect(Object.keys(cache).length).toBeGreaterThan(0);

    // Lấy ảnh thumbnail đầu tiên trong dropdown
    const dropdown = group!.querySelector('.nav-dropdown');
    const firstImg = dropdown?.querySelector('img') as HTMLImageElement;
    expect(firstImg).not.toBeNull();
    const firstSrc = firstImg.src;

    // Hover đi hover lại nhiều lần giữa các danh mục
    fireEvent.mouseLeave(group!);
    const otherParent = await screen.findByRole('link', { name: /^Áo khoác$/i });
    const otherGroup = otherParent.closest('.nav-group');
    fireEvent.mouseEnter(otherGroup!);
    fireEvent.mouseLeave(otherGroup!);

    // Hover lại vào "Quần"
    fireEvent.mouseEnter(group!);
    const secondImg = group!.querySelector('.nav-dropdown img') as HTMLImageElement;
    // Ảnh thumbnail phải giữ nguyên, không đổi src, không sinh ngẫu nhiên lại
    expect(secondImg.src).toBe(firstSrc);

    // Dữ liệu trong localStorage vẫn được giữ nguyên
    const rawCacheAfter = localStorage.getItem(cacheKey);
    expect(rawCacheAfter).toBe(rawCache);

    client.clear();
  });
});
