import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  orderService,
  syncMockOrdersFromDevServer,
} from '../services/orders';
import type { Address, CartItem, Order } from '../types/models';

describe('Quản lý đơn hàng & Đồng bộ mock orders', () => {
  const sampleAddress: Address = {
    id: 'addr-test',
    recipientName: 'Nguyễn Văn Test',
    phone: '0901234567',
    province: 'Hà Nội',
    district: 'Cầu Giấy',
    ward: 'Dịch Vọng Hậu',
    detail: 'Số 10 Phạm Hùng',
    isDefault: true,
  };

  const sampleItem: CartItem = {
    id: 'item-test',
    productId: 'prod-002',
    variantId: 'prod-002-0-0',
    productName: 'Áo blouse cổ vuông',
    productSlug: 'ao-blouse-co-vuong',
    imageUrl: 'https://example.com/item.jpg',
    size: 'S',
    color: 'Kem',
    unitPrice: 289000,
    quantity: 1,
    availableStock: 10,
    selected: true,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('tạo đơn hàng mới thành công và hiển thị đầu danh sách', async () => {
    const initialOrders = await orderService.list();
    const order = await orderService.create({
      userId: 'user-test-1',
      items: [sampleItem],
      address: sampleAddress,
      note: 'Giao giờ hành chính',
    });

    expect(order.id).toBeDefined();
    expect(order.orderCode).toMatch(/^FH-/);
    expect(order.status).toBe('PENDING');

    const orders = await orderService.list();
    expect(orders.length).toBe(initialOrders.length + 1);
    expect(orders[0].id).toBe(order.id);
    expect(orders[0].orderCode).toBe(order.orderCode);
  });

  it('cập nhật trạng thái đơn hàng và lưu lịch sử', async () => {
    const order = await orderService.create({
      userId: 'user-test-2',
      items: [sampleItem],
      address: sampleAddress,
    });

    const updated = await orderService.updateStatus(order.id, 'CONFIRMED');
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.history.some((h) => h.status === 'CONFIRMED')).toBe(true);

    const reloaded = await orderService.byId(order.id);
    expect(reloaded.status).toBe('CONFIRMED');
  });

  it('hòa trộn đơn hàng từ server đồng bộ dev với localStorage', async () => {
    const remoteOrder: Order = {
      id: 'order-from-other-window',
      orderCode: 'FH-9999999999',
      userId: 'user-remote',
      items: [
        {
          id: 'remote-line-1',
          productId: 'prod-002',
          variantId: 'prod-002-0-0',
          productName: 'Áo blouse cổ vuông',
          sku: 'FH-002-0-S',
          imageUrl: 'https://example.com/remote.jpg',
          size: 'S',
          color: 'Kem',
          unitPrice: 289000,
          quantity: 1,
          lineTotal: 289000,
        },
      ],
      shippingAddress: sampleAddress,
      subtotal: 289000,
      shippingFee: 30000,
      discountAmount: 0,
      totalAmount: 319000,
      paymentMethod: 'COD',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'PENDING', at: new Date().toISOString() }],
    };

    // Mock fetch for dev sync endpoint
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dev-mock/fashionhub_orders')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([remoteOrder]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }));

    await syncMockOrdersFromDevServer();

    const orders = await orderService.list();
    expect(orders.some((o) => o.id === 'order-from-other-window')).toBe(true);
  });

  it('đẩy trạng thái mới từ admin lên bộ nhớ dùng chung khi server còn bản cũ', async () => {
    const order = await orderService.create({ userId: 'user-sync-admin', items: [sampleItem], address: sampleAddress });
    const delivered: Order = { ...order, status: 'DELIVERED',
      updatedAt: new Date(Date.now() + 5000).toISOString(),
      history: [...order.history, { status: 'DELIVERED', at: new Date(Date.now() + 5000).toISOString() }] };
    localStorage.setItem('fashionhub_orders', JSON.stringify([delivered]));
    let shared: Order[] = [order];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, options?: RequestInit) => {
      if (options?.method === 'POST') {
        shared = JSON.parse(String(options.body)) as Order[];
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(shared) });
    }));
    await syncMockOrdersFromDevServer();
    expect(shared.find((entry) => entry.id === order.id)?.status).toBe('DELIVERED');
  });

  it('tự động cập nhật lịch sử xử lý đơn hàng khi nhận dữ liệu mới từ tab khác', async () => {
    // 1. Tạo đơn ban đầu ở tab hiện tại
    const initial = await orderService.create({
      userId: 'user-sync-test',
      items: [sampleItem],
      address: sampleAddress,
    });
    expect(initial.status).toBe('PENDING');
    expect(initial.history.length).toBe(1);

    // 2. Giả lập một tab khác (Admin) cập nhật đơn này lên PROCESSING (Đang chuẩn bị) rồi SHIPPING (Đang giao)
    const remoteUpdatedOrder: Order = {
      ...initial,
      status: 'SHIPPING',
      updatedAt: new Date(Date.now() + 10000).toISOString(),
      history: [
        ...initial.history,
        { status: 'CONFIRMED', at: new Date(Date.now() + 2000).toISOString() },
        { status: 'PROCESSING', at: new Date(Date.now() + 5000).toISOString() },
        { status: 'SHIPPING', at: new Date(Date.now() + 8000).toISOString() },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dev-mock/fashionhub_orders')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([remoteUpdatedOrder]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }));

    // 3. Khi tab người dùng gọi byId(id), hệ thống tự động đồng bộ và lấy lịch sử mới nhất
    const reloaded = await orderService.byId(initial.id);
    expect(reloaded.status).toBe('SHIPPING');
    expect(reloaded.history.length).toBe(4);
    expect(reloaded.history[3].status).toBe('SHIPPING');
  });

  it('không ghi đè localStorage liên tục khi dữ liệu không thay đổi (chống vòng lặp refetch gây giật lag)', async () => {
    const initial = await orderService.create({
      userId: 'user-no-loop-test',
      items: [sampleItem],
      address: sampleAddress,
    });

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    setItemSpy.mockClear();

    // Giả lập mock fetch trả về đúng dữ liệu hiện tại
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dev-mock/fashionhub_orders')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([initial]),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }));

    // Gọi byId liên tiếp
    await orderService.byId(initial.id);
    await orderService.byId(initial.id);

    // Không được gọi localStorage.setItem ('fashionhub_orders') vì dữ liệu không thay đổi
    const orderSaves = setItemSpy.mock.calls.filter((call) => call[0] === 'fashionhub_orders');
    expect(orderSaves.length).toBe(0);
  });
});
