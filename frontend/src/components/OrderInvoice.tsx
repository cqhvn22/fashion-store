import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, PackageCheck, Phone, MapPin } from 'lucide-react';
import type { Order } from '../types/models';
import { formatCurrency, formatDate, formatOrderStatus } from '../utils/format';
import { getThumbnailUrl } from '../utils/images';

/**
 * In riêng lẻ duy nhất một đơn hàng qua isolated iframe
 * để không bị lẫn bảng dữ liệu, danh sách đơn hay trạng thái khác của trang Admin
 */
export function printSingleOrderInvoice(order: Order, invoiceElement?: HTMLElement | null) {
  if (typeof document === 'undefined') return;

  const printFrame = document.createElement('iframe');
  printFrame.name = 'print-invoice-frame';
  printFrame.style.position = 'fixed';
  printFrame.style.top = '-9999px';
  printFrame.style.left = '-9999px';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc) {
    window.print();
    return;
  }

  // Thu thập style hiện có để giữ đúng định dạng font chữ, màu sắc
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join('\n');

  const contentHtml = invoiceElement ? invoiceElement.innerHTML : '';

  const html = `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Hóa đơn #${order.orderCode} - FashionHub</title>
    ${styles}
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box;
      }
      body {
        background: #ffffff !important;
        color: #0f172a !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .printable-invoice {
        max-width: 100% !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 4mm !important;
        box-shadow: none !important;
        border: none !important;
      }
      .no-print {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <div class="printable-invoice">
      ${contentHtml}
    </div>
  </body>
</html>`;

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const printWindow = printFrame.contentWindow;
  if (printWindow && typeof printWindow.print === 'function') {
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 3000);
      }
    };

    setTimeout(triggerPrint, 250);
  } else {
    // Môi trường không có print riêng trong iframe (hoặc test jsdom) thì gọi window.print()
    window.print();
    setTimeout(() => {
      if (document.body.contains(printFrame)) {
        document.body.removeChild(printFrame);
      }
    }, 1000);
  }
}

/**
 * Lightweight SVG Barcode renderer for invoice / shipping labels
 */
function BarcodeSvg({ text }: { text: string }) {
  // Simple deterministic pattern generator for barcode lines
  const chars = text.split('');
  const bars: { width: number; isBlack: boolean }[] = [];

  // Guard quiet zones
  bars.push({ width: 3, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });

  for (let i = 0; i < chars.length; i++) {
    const code = chars[i].charCodeAt(0);
    const pattern = [
      (code & 1) + 1,
      ((code >> 1) & 1) + 1,
      ((code >> 2) & 1) + 1,
      ((code >> 3) & 1) + 1,
    ];
    bars.push({ width: pattern[0], isBlack: true });
    bars.push({ width: pattern[1], isBlack: false });
    bars.push({ width: pattern[2], isBlack: true });
    bars.push({ width: pattern[3], isBlack: false });
  }

  // End pattern
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 3, isBlack: false });

  let currentX = 0;
  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="42" className="overflow-visible" aria-label={`Barcode ${text}`}>
        {bars.map((bar, index) => {
          const x = currentX;
          currentX += bar.width * 1.5;
          if (!bar.isBlack) return null;
          return (
            <rect
              key={index}
              x={x}
              y={0}
              width={bar.width * 1.5}
              height={38}
              fill="#000"
            />
          );
        })}
      </svg>
      <span className="font-mono text-[11px] tracking-wider text-slate-700 mt-1 font-semibold">
        *{text}*
      </span>
    </div>
  );
}

export function OrderInvoiceContent({ order }: { order: Order }) {
  return (
    <div className="printable-invoice bg-white text-slate-900 font-sans p-6 sm:p-8 max-w-[800px] mx-auto text-xs sm:text-sm leading-normal">
      {/* Top Header */}
      <div className="border-b-2 border-slate-900 pb-5 mb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-block bg-brand text-white font-extrabold px-2.5 py-1 text-base tracking-wider rounded-sm">
                FASHIONHUB
              </span>
              <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                Official Fulfillment
              </span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              CÔNG TY TNHH THỜI TRANG FASHIONHUB VIỆT NAM
              <br />
              Địa chỉ: 128 Trần Hưng Đạo, P. Phạm Ngũ Lão, Quận 1, TP. Hồ Chí Minh
              <br />
              Hotline: 1800 6000 · Email: support@fashionhub.vn · Website: www.fashionhub.vn
            </p>
          </div>

          <div className="text-left sm:text-right flex flex-col sm:items-end">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
              HÓA ĐƠN BÁN HÀNG
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              KIÊM PHIẾU ĐÓNG GÓI XUẤT KHO
            </p>
            <div className="mt-2 text-xs space-y-0.5">
              <p>
                Mã đơn hàng: <strong className="text-sm text-brand font-mono font-bold">#{order.orderCode}</strong>
              </p>
              <p>
                Ngày đặt: <span className="font-medium">{formatDate(order.createdAt)}</span>
              </p>
              <p>
                Trạng thái: <span className="font-semibold text-slate-800">{formatOrderStatus(order.status)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode & Routing */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-50 border border-slate-200 rounded mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-brand/10 text-brand flex items-center justify-center font-bold">
            <PackageCheck size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Dịch vụ giao vận & thu hộ
            </span>
            <span className="font-bold text-sm text-slate-900">
              Giao Hàng Nhanh Tiêu Chuẩn (COD)
            </span>
          </div>
        </div>
        <BarcodeSvg text={order.orderCode} />
      </div>

      {/* Sender & Receiver Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Sender */}
        <div className="border border-slate-200 rounded p-4 bg-white">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 pb-1 border-b border-slate-100">
            Từ: Bên gửi hàng (Sender)
          </h2>
          <strong className="block text-sm text-slate-900">FASHIONHUB FULFILLMENT CENTER</strong>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            Tổng kho: 128 Trần Hưng Đạo, P. Phạm Ngũ Lão, Quận 1, TP. HCM
            <br />
            Điện thoại: <strong>1800 6000</strong>
          </p>
        </div>

        {/* Receiver */}
        <div className="border-2 border-slate-900 rounded p-4 bg-white relative">
          <span className="absolute -top-2.5 right-3 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Người nhận (Receiver)
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 pb-1 border-b border-slate-100">
            Đến: Khách hàng
          </h2>
          <strong className="block text-base text-slate-900">
            {order.shippingAddress.recipientName}
          </strong>
          <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mt-0.5">
            <Phone size={14} className="text-brand flex-shrink-0" />
            <span>{order.shippingAddress.phone}</span>
          </div>
          <div className="flex items-start gap-1.5 text-xs text-slate-700 mt-1.5 leading-relaxed">
            <MapPin size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
            <span>
              {order.shippingAddress.detail}, {order.shippingAddress.ward}
              {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ''}, {order.shippingAddress.province}
            </span>
          </div>
          {order.note && (
            <div className="mt-2 pt-2 border-t border-dashed border-amber-300 text-xs text-amber-900 bg-amber-50/80 p-2 rounded">
              <strong>Ghi chú giao hàng:</strong> {order.note}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-800 text-left font-bold border-b border-slate-300">
              <th className="py-2.5 px-3 border-r border-slate-300 text-center w-10">STT</th>
              <th className="py-2.5 px-3 border-r border-slate-300">Sản phẩm & Mã SKU</th>
              <th className="py-2.5 px-3 border-r border-slate-300 text-center w-28">Phân loại</th>
              <th className="py-2.5 px-3 border-r border-slate-300 text-right w-24">Đơn giá</th>
              <th className="py-2.5 px-3 border-r border-slate-300 text-center w-14">SL</th>
              <th className="py-2.5 px-3 text-right w-28">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-medium text-slate-500">
                  {index + 1}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200">
                  <div className="flex items-center gap-2.5">
                    {item.imageUrl && (
                      <img
                        src={getThumbnailUrl(item.imageUrl)}
                        alt=""
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (item.imageUrl && target.src !== item.imageUrl) {
                            target.src = item.imageUrl;
                          }
                        }}
                        className="w-10 h-12 object-cover rounded border border-slate-200 flex-shrink-0"
                      />
                    )}
                    <div>
                      <strong className="block font-semibold text-slate-900 leading-snug">
                        {item.productName}
                      </strong>
                      <span className="text-[11px] font-mono text-slate-500">
                        SKU: {item.sku || 'N/A'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-medium">
                  {item.color} / {item.size}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-sm">
                  {item.quantity}
                </td>
                <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                  {formatCurrency(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary & Payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8 items-start">
        {/* Left instructions */}
        <div className="border border-slate-200 rounded p-3.5 bg-slate-50 text-xs space-y-2">
          <p className="font-bold text-slate-800 uppercase tracking-wide">
            Điều khoản & Hướng dẫn giao nhận
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Quý khách vui lòng kiểm tra đúng số lượng & sản phẩm trước khi nhận hàng.</li>
            <li>Hỗ trợ đổi size / màu trong vòng 7 ngày kể từ khi nhận hàng.</li>
            <li>Mọi yêu cầu hỗ trợ khiếu nại xin giữ nguyên tem mác và phiếu đóng gói này.</li>
          </ul>
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-700">
            <span>Phương thức thanh toán:</span>
            <strong className="text-slate-900">
              {order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : order.paymentMethod}
            </strong>
          </div>
        </div>

        {/* Right totals */}
        <div className="border border-slate-200 rounded p-4 bg-white space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Tổng tiền hàng:</span>
            <span className="font-mono font-medium">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Phí vận chuyển:</span>
            <span className="font-mono font-medium">
              {order.shippingFee === 0 ? 'Miễn phí' : formatCurrency(order.shippingFee)}
            </span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Chiết khấu / Giảm giá:</span>
              <span className="font-mono font-medium">-{formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          <div className="pt-2.5 border-t-2 border-slate-900 flex justify-between items-center bg-slate-50 -mx-4 -mb-4 p-4 rounded-b">
            <div>
              <span className="block font-bold text-slate-900 uppercase text-xs tracking-wider">
                TỔNG TIỀN PHẢI THU (COD):
              </span>
              <span className="text-[11px] text-slate-500 font-normal">
                (Đã bao gồm VAT và cước vận chuyển)
              </span>
            </div>
            <strong className="text-lg sm:text-xl font-black font-mono text-brand">
              {formatCurrency(order.totalAmount)}
            </strong>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="border-t border-slate-300 pt-6 mt-6">
        <div className="grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <strong className="block font-bold text-slate-800 uppercase">Người đóng gói</strong>
            <span className="text-slate-400 text-[11px] italic">(Ký & ghi rõ họ tên)</span>
            <div className="h-16" />
          </div>
          <div>
            <strong className="block font-bold text-slate-800 uppercase">Nhân viên giao nhận</strong>
            <span className="text-slate-400 text-[11px] italic">(Ký & ghi rõ họ tên)</span>
            <div className="h-16" />
          </div>
          <div>
            <strong className="block font-bold text-slate-800 uppercase">Người nhận hàng</strong>
            <span className="text-slate-400 text-[11px] italic">(Ký xác nhận đã nhận đủ hàng)</span>
            <div className="h-16" />
          </div>
        </div>
      </div>

      {/* Footer message */}
      <div className="text-center border-t border-dashed border-slate-200 pt-4 mt-4 text-[11px] text-slate-400">
        Cảm ơn quý khách đã mua sắm tại <strong>FashionHub</strong>! Hotline: 1800 6000 · Thời gian in: {new Date().toLocaleTimeString('vi-VN')} {new Date().toLocaleDateString('vi-VN')}
      </div>
    </div>
  );
}

export const invoiceActions = {
  print: printSingleOrderInvoice,
};

export function OrderInvoiceModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    invoiceActions.print(order, invoiceRef.current);
  };

  const modalNode = (
    <div
      className="printable-invoice-modal fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static"
      role="dialog"
      aria-modal="true"
      ref={modalRef}
    >
      <div className="w-full max-w-[850px] h-[92vh] max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700 print:h-auto print:max-h-none print:border-none print:shadow-none print:rounded-none">
        {/* Top Floating Control Bar (Fixed header) */}
        <div className="no-print flex-shrink-0 bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-brand flex items-center justify-center font-bold text-white text-sm">
              FH
            </div>
            <div>
              <h3 className="font-bold text-sm text-white leading-tight">
                Hóa đơn & Phiếu đóng gói
              </h3>
              <p className="text-xs text-slate-400">
                Đơn hàng #{order.orderCode} · {order.items.length} món
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary bg-brand text-white hover:bg-red-700 py-2 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm rounded-md transition-all active:scale-95"
              title="Chỉ in riêng hóa đơn đơn hàng này (không in các phần khác của website)"
            >
              <Printer size={16} />
              <span>In hóa đơn (PDF / Máy in)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded transition-colors"
              title="Đóng cửa sổ (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/90 print:p-0 print:bg-white overscroll-contain">
          <div
            ref={invoiceRef}
            className="bg-white rounded-lg shadow-sm border border-slate-200 print:shadow-none print:border-none mb-6"
          >
            <OrderInvoiceContent order={order} />
          </div>
          <div className="no-print text-center text-xs text-slate-400 pb-4 font-medium">
            ↕ Cuộn chuột để xem toàn bộ nội dung hóa đơn, danh sách sản phẩm & chữ ký xác nhận
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
