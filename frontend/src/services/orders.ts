import { seedOrders } from '../mocks/catalog';
import type { Address, CartItem, Order, OrderStatus } from '../types/models';
import { endpoints } from './endpoints';
import { httpClient, mockMode } from './httpClient';
import { getMockProducts, saveMockProducts } from './catalog';
import { readLocal, writeLocal } from './storage';
const key = 'fashionhub_orders';
export const getMockOrders = () => readLocal<Order[]>(key, seedOrders);
const save = (orders: Order[]) => writeLocal(key, orders);
export const shippingFeeFor = (subtotal: number) => (subtotal >= 500000 ? 0 : 30000);
export const orderService = {
  async list(userId?: string): Promise<Order[]> {
    if (mockMode)
      return getMockOrders()
        .filter((order) => !userId || order.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const { data } = await httpClient.get<{ data: Order[] }>(
      userId ? endpoints.myOrders : endpoints.admin.orders,
    );
    return data.data;
  },
  async byId(id: string): Promise<Order> {
    if (mockMode) {
      const order = getMockOrders().find((item) => item.id === id);
      if (!order) throw new Error('Không tìm thấy đơn hàng.');
      return order;
    }
    const { data } = await httpClient.get<{ data: Order }>(`${endpoints.orders}/${id}`);
    return data.data;
  },
  async create(input: {
    userId: string;
    items: CartItem[];
    address: Address;
    note?: string;
  }): Promise<Order> {
    if (!mockMode) {
      const { data } = await httpClient.post<{ data: Order }>(endpoints.orders, {
        items: input.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        shippingAddress: input.address,
        paymentMethod: 'COD',
        note: input.note,
      });
      return data.data;
    }
    const products = getMockProducts();
    for (const item of input.items) {
      const variant = products
        .find((product) => product.id === item.productId)
        ?.variants.find((entry) => entry.id === item.variantId);
      if (!variant || variant.stockQuantity < item.quantity)
        throw new Error(`${item.productName} không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.`);
    }
    const updated = products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => {
        const item = input.items.find((entry) => entry.variantId === variant.id);
        return item
          ? { ...variant, stockQuantity: variant.stockQuantity - item.quantity }
          : variant;
      }),
    }));
    const subtotal = input.items.reduce((sum, item) => {
        const variant = products
          .find((product) => product.id === item.productId)
          ?.variants.find((entry) => entry.id === item.variantId);
        return sum + (variant?.price ?? 0) * item.quantity;
      }, 0),
      now = new Date().toISOString();
    const id = crypto.randomUUID();
    const order: Order = {
      id,
      orderCode: `FH-${Date.now()}`,
      userId: input.userId,
      items: input.items.map((item) => {
        const variant = products
          .find((product) => product.id === item.productId)
          ?.variants.find((entry) => entry.id === item.variantId);
        return {
          id: crypto.randomUUID(),
          productId: item.productId,
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
    save([order, ...getMockOrders()]);
    return order;
  },
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    if (!mockMode) {
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
    save(getMockOrders().map((item) => (item.id === id ? updated : item)));
    return updated;
  },
};
