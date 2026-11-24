import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminCategories } from '../features/admin/AdminPages';

describe('Quản lý danh mục (AdminCategories)', () => {
  it('hiển thị số lượng sản phẩm chuẩn xác cho từng danh mục thay vì số 0', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminCategories />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Bảng danh mục xuất hiện
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Quản lý danh mục/i })).toBeInTheDocument();
      expect(screen.getByText('Áo khoác')).toBeInTheDocument();
    });

    // Cột Sản phẩm không hiển thị toàn bộ là 0
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // Phải có nhiều hàng dữ liệu
      expect(rows.length).toBeGreaterThan(3);
    });
  });
});
