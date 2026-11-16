import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogPage } from '../features/catalog/CatalogPages';

function renderWithRouter(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/categories/:slug" element={<CatalogPage mode="category" />} />
          <Route path="/products" element={<CatalogPage mode="products" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Chuyển danh mục trong CatalogPage', () => {
  it('cập nhật dữ liệu danh mục khi URL có ?category khác với slug', async () => {
    // Mô phỏng trường hợp URL: /categories/ao-nam?category=phu-kien
    renderWithRouter(['/categories/ao-nam?category=phu-kien']);

    await waitFor(() => {
      // Tiêu đề trang phải là Phụ kiện (thay vì bị kẹt ở Áo nam)
      const headings = screen.getAllByRole('heading', { name: /Phụ kiện/i });
      expect(headings.length).toBeGreaterThan(0);
    });

    // Kiểm tra sản phẩm thuộc danh mục Phụ kiện xuất hiện
    await waitFor(() => {
      expect(screen.getByText('Dép Da 1.9801')).toBeInTheDocument();
    });
  });

  it('chuyển sang danh mục khác khi bấm vào pill danh mục', async () => {
    renderWithRouter(['/categories/ao-nam']);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Áo nam/i })).toBeInTheDocument();
    });

    // Bấm vào nút "Phụ kiện" trên thanh pill (hoặc sidebar)
    const phuKienBtns = screen.getAllByRole('button', { name: 'Phụ kiện' });
    fireEvent.click(phuKienBtns[0]);

    await waitFor(() => {
      // Tiêu đề cập nhật sang Phụ kiện
      const headings = screen.getAllByRole('heading', { name: /Phụ kiện/i });
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  it('hiển thị phân trang gọn gàng với dấu ba chấm khi có nhiều trang', async () => {
    // /products có 280 sản phẩm, mỗi trang 12 sản phẩm => 24 trang
    renderWithRouter(['/products']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Trang 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Trang 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Trang 3' })).toBeInTheDocument();
      expect(screen.getByText('...')).toBeInTheDocument();
      // Không liệt kê dàn trải toàn bộ các trang giữa
      expect(screen.queryByRole('button', { name: 'Trang 15' })).not.toBeInTheDocument();
    });
  });

  it('hiển thị bộ lọc kích cỡ chuẩn thời trang nam M, L, XL, 2XL, 3XL', async () => {
    renderWithRouter(['/products']);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'XL' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2XL' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3XL' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Một cỡ' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'S' })).not.toBeInTheDocument();
    });
  });
});
