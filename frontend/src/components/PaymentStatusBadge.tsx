import type { Order } from '../types/models';

export function PaymentStatusBadge({ order }: { order: Order }) {
  if (order.paymentMethod !== 'PAYOS' && order.paymentStatus !== 'PAID') return null;
  const status = order.paymentStatus;
  const label = status === 'PAID' ? 'Đã thanh toán'
    : status === 'PENDING' ? 'Chờ thanh toán'
    : status === 'EXPIRED' ? 'Hết hạn thanh toán'
    : status === 'CANCELLED' ? 'Đã hủy thanh toán'
    : 'Chưa thanh toán';
  const tone = status === 'PAID' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-bold ${tone}`}>
    {label}
  </span>;
}
