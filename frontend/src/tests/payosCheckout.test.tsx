import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Order } from '../types/models';

const order = {
  id: 'order-1', orderCode: 'FH-001', totalAmount: 250000,
  paymentMethod: 'PAYOS', paymentStatus: 'PENDING', status: 'PENDING',
} as Order;

describe('chuyển khoản PayOS', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('gửi PAYOS tới Order service khi tạo đơn', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    const { httpClient } = await import('../services/httpClient');
    const { orderService } = await import('../services/orders');
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { data: order } });
    const result = await orderService.create({ userId: 'user-1', items: [{
      id: 'item-1', productId: 'product-1', variantId: 'variant-1', productName: 'Áo',
      productSlug: 'ao', imageUrl: '', color: 'Đen', size: 'M', unitPrice: 250000,
      quantity: 1, selected: true,
    }], address: { recipientName: 'Nguyễn A', phone: '0901234567', province: 'Hà Nội',
      ward: 'Phường Ba Đình', detail: 'Số 1' }, paymentMethod: 'PAYOS' });
    expect(result.paymentMethod).toBe('PAYOS');
    expect(post).toHaveBeenCalledWith('/orders', expect.objectContaining({ paymentMethod: 'PAYOS' }),
      expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }));
  });

  it('hủy đơn bằng API của khách thay vì API quản trị', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    const { httpClient } = await import('../services/httpClient');
    const { orderService } = await import('../services/orders');
    const patch = vi.spyOn(httpClient, 'patch').mockResolvedValue({ data: { data: order } });
    await orderService.cancel('order-1');
    expect(patch).toHaveBeenCalledWith('/orders/order-1/cancel');
  });

  it('không coi tham số URL là bằng chứng đã thanh toán', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_MOCK', 'false');
    const { orderService } = await import('../services/orders');
    vi.spyOn(orderService, 'byId').mockResolvedValue(order);
    const { PaymentReturnPage } = await import('../features/checkout/CheckoutPages');
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/payment/success?orderId=order-1&status=PAID']}>
        <PaymentReturnPage />
      </MemoryRouter>
    </QueryClientProvider>);
    expect(await screen.findByText('Đang kiểm tra thanh toán')).toBeInTheDocument();
    expect(screen.queryByText('Đã nhận thanh toán')).not.toBeInTheDocument();
  });
});
