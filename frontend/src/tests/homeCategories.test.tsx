import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminHomeCategories } from '../features/admin/AdminHomeCategories';
import { HomePage } from '../features/catalog/CatalogPages';
import { homeCategoryService } from '../services/homeCategories';

describe('Quản lý danh mục hiển thị Trang chủ (Home Category Showcases)', () => {
  it('homeCategoryService cung cấp danh sách danh mục trang chủ ban đầu', async () => {
    const list = await homeCategoryService.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('title');
    expect(list[0]).toHaveProperty('selectionMode');
  });

  it('AdminHomeCategories hiển thị danh sách cấu hình và nút thêm mới', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminHomeCategories />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /Quản lý danh mục hiển thị Trang chủ/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Thêm danh mục trang chủ/i })
      ).toBeInTheDocument();
    });
  });

  it('HomePage giữ nguyên DANH MỤC NỔI BẬT, HÀNG MỚI VỀ và hiển thị các khối danh mục trang chủ', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      // Giữ nguyên các phần cũ
      expect(screen.getByText('DANH MỤC NỔI BẬT')).toBeInTheDocument();
      expect(screen.getByText('HÀNG MỚI VỀ')).toBeInTheDocument();
      // Khối danh mục động từ homeCategories
      expect(screen.getByText('BỘ SƯU TẬP ÁO POLO')).toBeInTheDocument();
    });
  });

  it('hỗ trợ lưu và hiển thị cấu hình ở chế độ chọn sản phẩm cụ thể (CUSTOM)', async () => {
    const customShowcase = await homeCategoryService.save({
      title: 'DANH MỤC TUYỂN CHỌN ĐẶC BIỆT',
      categoryId: 'cat-atino-ao-polo',
      selectionMode: 'CUSTOM',
      productIds: ['p37937196', 'p37937106'],
      displayLimit: 4,
      sortOrder: 5,
      isActive: true,
    });
    expect(customShowcase.selectionMode).toBe('CUSTOM');
    expect(customShowcase.productIds).toContain('p37937196');
  });
});
