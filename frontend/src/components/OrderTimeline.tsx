import type { ComponentType } from 'react';
import {
  Clock,
  FileCheck2,
  Package,
  Truck,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import type { OrderStatus } from '../types/models';
import { formatDate, formatOrderStatus } from '../utils/format';

interface StatusMeta {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  dotColor: string;
  badgeTone: string;
}

const statusConfig: Record<OrderStatus, StatusMeta> = {
  PENDING: {
    title: 'Chờ xác nhận',
    description: 'Đơn hàng mới tạo thành công, chờ kiểm tra thông tin và xuất kho.',
    icon: Clock,
    dotColor: 'text-amber-600 border-amber-500 bg-amber-50',
    badgeTone: 'bg-amber-100 text-amber-800',
  },
  CONFIRMED: {
    title: 'Đã xác nhận',
    description: 'Nhân viên đã xác nhận đơn hàng, chuyển tiếp sang bộ phận kho.',
    icon: FileCheck2,
    dotColor: 'text-blue-600 border-blue-500 bg-blue-50',
    badgeTone: 'bg-blue-100 text-blue-800',
  },
  PROCESSING: {
    title: 'Đang chuẩn bị hàng',
    description: 'Kho đang lấy hàng, đóng gói kiện hàng và dán nhãn vận chuyển.',
    icon: Package,
    dotColor: 'text-indigo-600 border-indigo-500 bg-indigo-50',
    badgeTone: 'bg-indigo-100 text-indigo-800',
  },
  SHIPPING: {
    title: 'Đang giao hàng',
    description: 'Kiện hàng đã bàn giao cho shipper và đang trên đường giao.',
    icon: Truck,
    dotColor: 'text-sky-600 border-sky-500 bg-sky-50',
    badgeTone: 'bg-sky-100 text-sky-800',
  },
  DELIVERED: {
    title: 'Đã giao hàng',
    description: 'Kiện hàng đã được giao thành công tới tay người nhận.',
    icon: CheckCircle,
    dotColor: 'text-emerald-600 border-emerald-500 bg-emerald-50',
    badgeTone: 'bg-emerald-100 text-emerald-800',
  },
  CANCELLED: {
    title: 'Đã hủy',
    description: 'Đơn hàng đã được hủy và hoàn tất xử lý hoàn kho.',
    icon: XCircle,
    dotColor: 'text-rose-600 border-rose-500 bg-rose-50',
    badgeTone: 'bg-rose-100 text-rose-800',
  },
};

export function OrderTimeline({
  history,
  className = '',
}: {
  history: Array<{ status: OrderStatus; at: string }>;
  className?: string;
}) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-slate-400 py-2">Chưa có lịch sử xử lý.</p>;
  }

  return (
    <div className={`relative pl-1 py-1 ${className}`}>
      {history.map((event, index) => {
        const isLatest = index === history.length - 1;
        const config = statusConfig[event.status] ?? statusConfig.PENDING;
        const Icon = config.icon;

        return (
          <div
            key={`${event.status}-${event.at}-${index}`}
            className="relative flex items-start gap-3.5 pb-6 last:pb-1"
          >
            {/* Connecting line */}
            {index < history.length - 1 && (
              <span
                className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-slate-200"
                aria-hidden="true"
              />
            )}

            {/* Icon Node */}
            <div className="relative z-10 flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isLatest
                    ? `${config.dotColor} ring-4 ring-slate-100 shadow-sm scale-105 font-bold`
                    : 'border-slate-300 bg-slate-50 text-slate-500'
                }`}
                title={formatOrderStatus(event.status)}
              >
                <Icon size={16} />
              </div>
            </div>

            {/* Event Details */}
            <div className="flex-1 pt-0.5 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                <span
                  className={`text-sm flex items-center gap-2 ${
                    isLatest ? 'font-bold text-ink' : 'font-semibold text-slate-700'
                  }`}
                >
                  <span>{formatOrderStatus(event.status)}</span>
                  {isLatest && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand/10 text-brand">
                      Hiện tại
                    </span>
                  )}
                </span>
                <time className="text-[11px] font-medium text-slate-500">
                  {formatDate(event.at)}
                </time>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {config.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
