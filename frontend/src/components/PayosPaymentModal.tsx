import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { orderService } from '../services/orders';
import { formatCurrency } from '../utils/format';

export function PayosPaymentModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['payment', orderId],
    queryFn: () => orderService.payment(orderId),
    refetchInterval: (query) => query.state.data?.paymentStatus === 'PENDING' ? 5000 : false,
    refetchOnWindowFocus: 'always',
  });
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKey); };
  }, [onClose]);
  const paid = data?.paymentStatus === 'PAID';
  useEffect(() => {
    if (!paid) return;
    void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [paid, orderId, queryClient]);
  const expired = data?.paymentStatus === 'EXPIRED' || data?.paymentStatus === 'CANCELLED';
  const attempt = data?.attempt;
  return createPortal(<div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/65 p-3"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Thanh toán chuyển khoản" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-brand">Chuyển khoản PayOS</p>
          <h2 className="mt-1 text-xl font-bold">{paid ? 'Đã thanh toán thành công' : expired ? 'Đơn hàng đã hết hạn' : 'Quét mã để thanh toán'}</h2></div>
        <button type="button" onClick={onClose} aria-label="Đóng thanh toán" className="text-2xl text-slate-500 hover:text-ink">×</button>
      </div>
      <div role="status" className="mt-5 flex items-center gap-2 text-xs font-bold sm:text-sm">
        <span className={paid ? 'text-slate-500' : 'text-amber-700'}>① Chờ thanh toán</span>
        <span aria-hidden="true" className="text-slate-400">→</span>
        <span className={paid ? 'text-emerald-700' : 'text-slate-400'}>② Đã thanh toán</span>
      </div>
      {isPending ? <p className="mt-6 text-sm">Đang lấy thông tin chuyển khoản…</p> : error ?
        <div className="mt-6 text-sm"><p className="text-red-700">Chưa tải được thông tin thanh toán.</p>
          <button type="button" className="btn-outline mt-3" onClick={() => void refetch()}>Thử lại</button></div> :
        paid ? <p className="mt-6 rounded bg-emerald-50 p-4 text-sm text-emerald-800">Cửa hàng đã xác nhận khoản thanh toán. Bạn có thể theo dõi đơn hàng.</p> :
        expired ? <p className="mt-6 rounded bg-amber-50 p-4 text-sm text-amber-900">Đơn chưa được thanh toán và đã hết hạn. Vui lòng đặt đơn mới nếu vẫn muốn mua sản phẩm.</p> :
        <>
          <p className="mt-4 text-sm text-slate-600">Dùng ứng dụng ngân hàng để quét mã. Vui lòng chuyển đúng số tiền và nội dung hiển thị; trạng thái sẽ tự cập nhật sau mỗi 5 giây.</p>
          {attempt?.qrCode ? <div className="mx-auto mt-5 w-fit border p-3" aria-label="Mã QR chuyển khoản PayOS">
            <QRCodeSVG value={attempt.qrCode} size={230} level="M" />
          </div> : <p className="mt-5 rounded bg-amber-50 p-3 text-sm text-amber-900">Chưa có mã QR cho đơn này. Bạn có thể mở trang thanh toán PayOS bên dưới.</p>}
          <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-3"><dt>Số tiền</dt><dd className="font-bold text-brand">{formatCurrency(attempt?.amount ?? 0)}</dd></div>
            {attempt?.accountName && <div className="flex justify-between gap-3"><dt>Người nhận</dt><dd className="text-right font-semibold">{attempt.accountName}</dd></div>}
            {attempt?.accountNumber && <div className="flex justify-between gap-3"><dt>Số tài khoản</dt><dd className="font-semibold">{attempt.accountNumber}</dd></div>}
            {attempt?.transferDescription && <div className="flex justify-between gap-3"><dt>Nội dung</dt><dd className="font-semibold">{attempt.transferDescription}</dd></div>}
            {attempt?.expiresAt && <div className="flex justify-between gap-3"><dt>Hạn thanh toán</dt><dd>{new Date(attempt.expiresAt).toLocaleTimeString('vi-VN')}</dd></div>}
          </dl>
          <p role="status" className="mt-4 rounded bg-slate-50 p-3 text-center text-sm">Chờ thanh toán · Đang kiểm tra tự động</p>
          {data?.statusCheckUnavailable && <p className="mt-2 rounded bg-amber-50 p-3 text-center text-sm text-amber-900">Chưa kiểm tra được trạng thái mới nhất từ PayOS. Vui lòng giữ biên lai; hệ thống sẽ tự thử lại.</p>}
          <button type="button" className="mt-2 w-full text-sm font-semibold text-brand hover:underline" onClick={() => void refetch()}>Kiểm tra ngay</button>
          {attempt?.checkoutUrl && <a className="btn-outline mt-4 block text-center" href={attempt.checkoutUrl} target="_blank" rel="noopener noreferrer">Mở PayOS trên thiết bị này</a>}
        </>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link className="btn-primary" to={`/account/orders/${orderId}`} onClick={onClose}>Xem đơn hàng</Link>
        <button type="button" className="btn-outline" onClick={onClose}>Đóng</button>
      </div>
      {!paid && !expired && <p className="mt-4 text-center text-xs text-slate-500">Đóng cửa sổ này không hủy đơn hàng. Bạn có thể mở lại từ chi tiết đơn.</p>}
    </div>
  </div>, document.body);
}
