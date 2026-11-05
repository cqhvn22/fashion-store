import type { OrderStatus } from '../types/models';
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang chuẩn bị',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};
export const formatOrderStatus = (value: OrderStatus) => orderStatusLabels[value];
export const cartSubtotal = (
  items: { unitPrice: number; quantity: number; selected?: boolean }[],
) =>
  items
    .filter((item) => item.selected !== false)
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
