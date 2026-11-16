import { seedOrders } from '../mocks/catalog';
import type { Address, CartItem, Order, OrderStatus } from '../types/models';
import { endpoints } from './endpoints';
import { httpClient, useDbOrders } from './httpClient';
import { getMockProducts, saveMockProducts } from './catalog';
import { useAuthStore } from '../stores/authStore';
import { readLocal, writeLocal } from './storage';
import { addMockNotification } from './notifications';
import { formatCurrency, formatOrderStatus } from '../utils/format';
const key = 'fashionhub_orders';
export const getMockOrders = () => readLocal<Order[]>(key, seedOrders);
const save = (orders: Order[]) => writeLocal(key, orders);
export const shippingFeeFor = (subtotal: number) => (subtotal >= 500000 ? 0 : 30000);

const devSyncUrl = '/api/dev-mock/fashionhub_orders';

export async function fetchDevServerMockOrders(): Promise<Order[] | null> {
  if (typeof window === 'undefined' || useDbOrders) return null;
  try {
    const res = await fetch(devSyncUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? (data as Order[]) : null;
  } catch {
    return null;
  }
}

export async function pushDevServerMockOrders(orders: Order[]): Promise<void> {
  if (typeof window === 'undefined' || useDbOrders) return;
  try {
    await fetch(devSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orders),
    });
  } catch {
    // Ignore errors in offline / testing environments
  }
}

export async function syncMockOrdersFromDevServer(): Promise<void> {
  if (typeof window === 'undefined' || useDbOrders) return;
  try {
    const remote = await fetchDevServerMockOrders();
    const local = getMockOrders();
    if (remote && remote.length > 0) {
      const map = new Map<string, Order>();
      for (const item of local) map.set(item.id, item);
      for (const item of remote) {
        const localItem = map.get(item.id);
        if (!localItem) {
          map.set(item.id, item);
        } else {
          // Compare updatedAt and history length to keep the latest order status & history
          const remoteTime = new Date(item.updatedAt || item.createdAt).getTime();
          const localTime = new Date(localItem.updatedAt || localItem.createdAt).getTime();
          const remoteHist = item.history?.length ?? 0;
          const localHist = localItem.history?.length ?? 0;
          if (remoteTime > localTime || (remoteTime === localTime && remoteHist >= localHist)) {
            map.set(item.id, item);
          }
        }
      }
      const merged = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (JSON.stringify(merged) !== JSON.stringify(local)) {
        save(merged);
      }
      await pushDevServerMockOrders(merged);
    }
  } catch {
    // Ignore
  }
}

export const orderService = {
  async list(userId?: string): Promise<Order[]> {
    if (!useDbOrders) {
      await syncMockOrdersFromDevServer();
      return getMockOrders()
        .filter((order) => !userId || order.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    const { data } = await httpClient.get<{ data: Order[] }>(
      userId ? endpoints.myOrders : endpoints.admin.orders,
    );
    return data.data;
  },
  async byId(id: string): Promise<Order> {
    if (!useDbOrders) {
      await syncMockOrdersFromDevServer();
      const order = getMockOrders().find((item) => item.id === id);
      if (!order) throw new Error('Không tìm thấy đơn hàng.');
      return order;
    }
    const { data } = await httpClient.get<{ data: Order }>(
      useAuthStore.getState().user?.role === 'ADMIN'
        ? `${endpoints.admin.orders}/${id}` : `${endpoints.orders}/${id}`,
    );
    return data.data;
  },
  async create(input: {
    userId: string;
    items: CartItem[];
    address: Address;
    note?: string;
    idempotencyKey?: string;
  }): Promise<Order> {
    if (useDbOrders) {
      const { data } = await httpClient.post<{ data: Order }>(endpoints.orders, {
        items: input.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity,
          expectedUnitPrice: item.unitPrice })),
        shippingAddress: input.address,
        paymentMethod: 'COD',
        note: input.note,
      }, {
        headers: { 'Idempotency-Key': input.idempotencyKey ?? crypto.randomUUID() },
      });
      return data.data;
    }
    const products = getMockProducts();
    for (const item of input.items) {
      const product = products.find((entry) => entry.id === item.productId);
      const variant =
        product?.variants.find((entry) => entry.id === item.variantId) ??
        product?.variants.find(
          (entry) =>
            (!item.color || entry.color === item.color) &&
            (!item.size || entry.size === item.size),
        );
      if (variant && variant.stockQuantity < item.quantity)
        throw new Error(`${item.productName} không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.`);
    }
    const updated = products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => {
        const item = input.items.find(
          (entry) =>
            entry.variantId === variant.id ||
            (entry.productId === product.id &&
              entry.color === variant.color &&
              entry.size === variant.size),
        );
        return item
          ? { ...variant, stockQuantity: Math.max(0, variant.stockQuantity - item.quantity) }
          : variant;
      }),
    }));
    const subtotal = input.items.reduce((sum, item) => {
        const product = products.find((entry) => entry.id === item.productId);
        const variant =
          product?.variants.find((entry) => entry.id === item.variantId) ??
          product?.variants.find(
            (entry) =>
              (!item.color || entry.color === item.color) &&
              (!item.size || entry.size === item.size),
          );
        return sum + (variant?.price ?? item.unitPrice ?? 0) * item.quantity;
      }, 0),
      now = new Date().toISOString();
    const id = crypto.randomUUID();
    const order: Order = {
      id,
      orderCode: `FH-${Date.now()}`,
      userId: input.userId,
      items: input.items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        const variant =
          product?.variants.find((entry) => entry.id === item.variantId) ??
          product?.variants.find(
            (entry) =>
              (!item.color || entry.color === item.color) &&
              (!item.size || entry.size === item.size),
          );
        return {
          id: crypto.randomUUID(),
          productId: item.productId,
          productSlug: product?.slug || (item as any).productSlug,
          variantId: item.variantId,
          productName: item.productName,
          sku: variant?.sku ?? '',
          imageUrl: item.imageUrl,
          size: item.size,
          color: item.color,
          unitPrice: variant?.price ?? item.unitPrice,
          quantity: item.quantity,
          lineTotal: (variant?.price ?? item.unitPrice) * item.quantity,
        };
      }),
      shippingAddress: input.address,
      subtotal,
      shippingFee: shippingFeeFor(subtotal),
      discountAmount: 0,
      totalAmount: subtotal + shippingFeeFor(subtotal),
      paymentMethod: 'COD',
      status: 'PENDING',
      note: input.note,
      createdAt: now,
      updatedAt: now,
      history: [{ status: 'PENDING', at: now }],
    };
    saveMockProducts(updated);
    const allOrders = [order, ...getMockOrders()];
    save(allOrders);
    await pushDevServerMockOrders(allOrders);

    if (!useDbOrders) {
      addMockNotification({
        recipientUserId: input.userId,
        orderId: order.id,
        subject: 'Đơn hàng mới',
        body: `Đơn ${order.orderCode} đã được đặt thành công.`,
      });
      addMockNotification({
        recipientUserId: 'admin-demo',
        orderId: order.id,
        subject: 'Đơn hàng mới từ khách',
        body: `Có đơn hàng ${order.orderCode} vừa được đặt (${order.shippingAddress.recipientName} - ${formatCurrency(order.totalAmount)}).`,
      });
    }

    return order;
  },
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    if (useDbOrders) {
      const { data } = await httpClient.patch<{ data: Order }>(
        `${endpoints.admin.orders}/${id}/status`,
        { status },
      );
      return data.data;
    }
    const order = await this.byId(id);
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PROCESSING', 'CANCELLED'],
      PROCESSING: ['SHIPPING'],
      SHIPPING: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!transitions[order.status].includes(status))
      throw new Error('Chuyển trạng thái không hợp lệ.');
    const now = new Date().toISOString();
    const updated = {
      ...order,
      status,
      updatedAt: now,
      history: [...order.history, { status, at: now }],
    };
    const allOrders = getMockOrders().map((item) => (item.id === id ? updated : item));
    save(allOrders);
    await pushDevServerMockOrders(allOrders);

    if (!useDbOrders) {
      const statusLabel = formatOrderStatus(status);
      addMockNotification({
        recipientUserId: order.userId,
        orderId: order.id,
        subject: status === 'CANCELLED' ? 'Đơn hàng đã bị hủy' : 'Cập nhật trạng thái đơn hàng',
        body: status === 'CANCELLED'
          ? `Đơn hàng ${order.orderCode} của bạn đã bị hủy.`
          : `Đơn hàng ${order.orderCode} của bạn đã chuyển sang trạng thái "${statusLabel}".`,
      });
      addMockNotification({
        recipientUserId: 'admin-demo',
        orderId: order.id,
        subject: 'Cập nhật trạng thái đơn hàng',
        body: `Đơn ${order.orderCode} đã chuyển sang "${statusLabel}".`,
      });
    }

    return updated;
  },
};
