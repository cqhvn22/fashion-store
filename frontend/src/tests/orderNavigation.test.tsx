import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrdersPage, OrderDetailPage } from '../features/account/AccountPages';
import { orderService } from '../services/orders';
import { useAuthStore } from '../stores/authStore';
import { demoUsers } from '../mocks/catalog';
import type { Order } from '../types/models';

vi.mock('../services/orders', () => ({
  orderService: {
    list: vi.fn(),
    byId: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../services/reviews', () => ({
  reviewService: {
    mine: vi.fn().mockResolvedValue([]),
  },
}));

describe('Điều hướng từ đơn hàng sang chi tiết sản phẩm', () => {
  const mockOrderWithSlug: Order = {
    id: 'ord-test-slug',
    orderCode: 'FH-202611001',
    userId: demoUsers[0].id,
    items: [
      {
        id: 'item-1',
        productId: 'prod-101',
        productSlug: 'ao-so-mi-linen-dang-rong',
        variantId: 'var-1',
        productName: 'Áo sơ mi linen dáng rộng',
        sku: 'FH-001-L',
        imageUrl: 'https://images.unsplash.com/photo-1598554747436?w=200',
        size: 'L',
        color: 'Trắng',
        unitPrice: 350000,
        quantity: 1,
        lineTotal: 350000,
      },
    ],
    shippingAddress: {
      recipientName: 'Nguyễn Văn A',
      phone: '0901234567',
      province: 'Hà Nội',
      district: 'Hoàn Kiếm',
      ward: 'Hàng Bạc',
      detail: '10 Tràng Tiền',
    },
    subtotal: 350000,
    shippingFee: 0,
    discountAmount: 0,
    totalAmount: 350000,
    paymentMethod: 'COD',
    status: 'PROCESSING',
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    history: [{ status: 'PROCESSING', at: '2026-11-12T10:00:00.000Z' }],
  };

  const mockOrderFallbackId: Order = {
    id: 'ord-test-id',
    orderCode: 'FH-202611002',
    userId: demoUsers[0].id,
    items: [
      {
        id: 'item-2',
        productId: 'prod-202',
        variantId: 'var-2',
        productName: 'Quần jeans baggy nam',
        sku: 'FH-002-32',
        imageUrl: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=200',
        size: '32',
        color: 'Xanh đậm',
        unitPrice: 420000,
        quantity: 1,
        lineTotal: 420000,
      },
    ],
    shippingAddress: {
      recipientName: 'Nguyễn Văn A',
      phone: '0901234567',
      province: 'Hà Nội',
      district: 'Hoàn Kiếm',
      ward: 'Hàng Bạc',
      detail: '10 Tràng Tiền',
    },
    subtotal: 420000,
    shippingFee: 0,
    discountAmount: 0,
    totalAmount: 420000,
    paymentMethod: 'COD',
    status: 'DELIVERED',
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
    history: [{ status: 'DELIVERED', at: '2026-11-11T10:00:00.000Z' }],
  };

  beforeEach(() => {
    useAuthStore.setState({ user: demoUsers[0] });
    vi.clearAllMocks();
  });

  it('trong trang danh sách đơn hàng (OrdersPage): bấm vào tên hoặc ảnh sản phẩm có liên kết tới chi tiết sản phẩm', async () => {
    vi.mocked(orderService.list).mockResolvedValue([mockOrderWithSlug]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/account/orders']}>
          <Routes>
            <Route path="/account/orders" element={<OrdersPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Chờ đơn hàng hiển thị
    await waitFor(() => {
      expect(screen.getAllByText('Áo sơ mi linen dáng rộng').length).toBeGreaterThan(0);
    });

    // Cả ảnh và tên sản phẩm đều là thẻ link trỏ về trang chi tiết sản phẩm
    const productLinks = screen.getAllByRole('link', { name: 'Áo sơ mi linen dáng rộng' });
    expect(productLinks.length).toBe(2);
    expect(productLinks[0]).toHaveAttribute('href', '/products/ao-so-mi-linen-dang-rong');
    expect(productLinks[1]).toHaveAttribute('href', '/products/ao-so-mi-linen-dang-rong');

    // Link xem chi tiết đơn hàng vẫn hoạt động riêng biệt
    const orderCodeLink = screen.getByRole('link', { name: /FH-202611001/i });
    expect(orderCodeLink).toHaveAttribute('href', '/account/orders/ord-test-slug');
  });

  it('trong trang chi tiết đơn hàng (OrderDetailPage): bấm vào tên hoặc ảnh sản phẩm dẫn tới chi tiết sản phẩm', async () => {
    vi.mocked(orderService.byId).mockResolvedValue(mockOrderWithSlug);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/account/orders/ord-test-slug']}>
          <Routes>
            <Route path="/account/orders/:orderId" element={<OrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Áo sơ mi linen dáng rộng').length).toBeGreaterThan(0);
    });

    // Cả ảnh và tên sản phẩm trong chi tiết đơn hàng đều dẫn đến trang chi tiết sản phẩm
    const productLinks = screen.getAllByRole('link', { name: 'Áo sơ mi linen dáng rộng' });
    expect(productLinks.length).toBe(2);
    expect(productLinks[0]).toHaveAttribute('href', '/products/ao-so-mi-linen-dang-rong');
    expect(productLinks[1]).toHaveAttribute('href', '/products/ao-so-mi-linen-dang-rong');
  });

  it('hỗ trợ fallback điều hướng theo productId khi đơn hàng không có productSlug', async () => {
    vi.mocked(orderService.byId).mockResolvedValue(mockOrderFallbackId);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/account/orders/ord-test-id']}>
          <Routes>
            <Route path="/account/orders/:orderId" element={<OrderDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Quần jeans baggy nam').length).toBeGreaterThan(0);
    });

    // Cả ảnh và tên dẫn theo fallback productId
    const productLinks = screen.getAllByRole('link', { name: 'Quần jeans baggy nam' });
    expect(productLinks.length).toBe(2);
    expect(productLinks[0]).toHaveAttribute('href', '/products/prod-202');
    expect(productLinks[1]).toHaveAttribute('href', '/products/prod-202');
  });
});
