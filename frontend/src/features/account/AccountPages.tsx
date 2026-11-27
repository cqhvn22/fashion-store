import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import { EmptyState, ErrorState, PageHeading, ProductSkeleton } from '../../components/common';
import { ProvinceWardFields, isValidDivision } from '../../components/ProvinceWardFields';
import { ProductGrid } from '../../components/ProductCard';
import { OrderTimeline } from '../../components/OrderTimeline';
import { OrderInvoiceModal } from '../../components/OrderInvoice';
import { PayosPaymentModal } from '../../components/PayosPaymentModal';
import { ReviewEditor } from '../../components/ReviewEditor';
import { reviewService } from '../../services/reviews';
import { getMockProducts, productService } from '../../services/catalog';
import { useDbAuth, useDbCatalog } from '../../services/httpClient';
import { orderService } from '../../services/orders';
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge';
import { loyaltyService, tierNames } from '../../services/loyalty';
import { addressService } from '../../services/addresses';
import { useAuthStore } from '../../stores/authStore';
import { useWishlistStore } from '../../stores/wishlistStore';
import type { Address, OrderItem, OrderStatus } from '../../types/models';
import { formatCurrency, formatDate, formatOrderStatus } from '../../utils/format';
import { getCardImageUrl, showProductPlaceholder } from '../../utils/images';

function AccountShell({ children }: { children: React.ReactNode }) {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  return (
    <div className="container-shell py-10">
      <PageHeading eyebrow="MY FASHIONHUB" title="Tài khoản của tôi" />
      <div className="md:grid md:grid-cols-[210px_1fr] gap-7">
        <nav className="bg-white rounded p-3 h-fit mb-5 space-y-1">
          <NavLink className="account-nav" to="/account/profile">
            Thông tin cá nhân
          </NavLink>
          <NavLink className="account-nav" to="/account/addresses">
            Sổ địa chỉ
          </NavLink>
          <NavLink className="account-nav" to="/account/orders">
            Đơn hàng của tôi
          </NavLink>
          <NavLink className="account-nav" to="/wishlist">
            Yêu thích
          </NavLink>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="account-nav w-full text-left"
          >
            Đăng xuất
          </button>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
export function ProfilePage() {
  const user = useAuthStore((state) => state.user)!;
  const update = useAuthStore((state) => state.update);
  const changePassword = useAuthStore((state) => state.changePassword);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [message, setMessage] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const loyalty = useQuery({ queryKey: ['loyalty', user.id], queryFn: loyaltyService.mine, enabled: useDbAuth });
  return (
    <AccountShell>
      <div className="panel mb-5">
        <h2 className="text-xl font-bold">Hạng thành viên</h2>
        {!useDbAuth ? <p className="mt-3 text-slate-500">Đăng nhập vào cửa hàng để xem điểm thành viên.</p> :
          loyalty.isLoading ? <p className="mt-3 text-slate-500">Đang tải quyền lợi...</p> :
          loyalty.isError ? <p className="mt-3 text-red-600">Chưa xem được điểm thành viên. <button className="underline" onClick={() => void loyalty.refetch()}>Thử lại</button></p> :
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm text-slate-500">Hạng hiện tại</p><p className="text-xl font-bold">{tierNames[loyalty.data!.tier]}</p></div>
            <div><p className="text-sm text-slate-500">Điểm đã tích</p><p className="text-xl font-bold">{loyalty.data!.points.toLocaleString('vi-VN')}</p></div>
            <div><p className="text-sm text-slate-500">Trong {loyalty.data!.windowMonths} tháng gần đây</p><p className="font-semibold">{loyalty.data!.orderCount} đơn · {formatCurrency(loyalty.data!.spent)}</p></div>
            <p className="sm:col-span-3 text-sm text-slate-500">Mỗi {formatCurrency(loyalty.data!.vndPerPoint)} tiền hàng sau giảm giá được 1 điểm khi đơn đã giao và thanh toán thành công.</p>
            {!!loyalty.data!.offers.length && <div className="sm:col-span-3 border-t pt-3"><h3 className="font-bold mb-2">Ưu đãi dành cho bạn</h3>{loyalty.data!.offers.map((offer) => <p key={`${offer.name}-${offer.endsAt}`} className="text-sm">{offer.name}: giảm {offer.discountType === 'PERCENT' ? `${offer.discountValue}%` : formatCurrency(offer.discountValue)} cho đơn từ {formatCurrency(offer.minSubtotal)}</p>)}</div>}
          </div>}
      </div>
      <div className="panel">
        <h2 className="text-xl font-bold mb-5">Thông tin cá nhân</h2>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await update({ fullName: name, phone });
              setMessage('Đã cập nhật thông tin.');
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Không thể cập nhật.');
            }
          }}
          className="max-w-lg space-y-4"
        >
          <label className="form-label">
            Họ và tên
            <input
              required
              minLength={2}
              maxLength={150}
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="form-label">
            Email
            <input className="field bg-slate-50" value={user.email} disabled />
          </label>
          <label className="form-label">
            Số điện thoại
            <input
              className="field"
              value={phone}
              pattern="0[0-9]{9}"
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <button className="btn-primary">Lưu thay đổi</button>
          {message && <p className="text-sm text-green-700">{message}</p>}
        </form>
        <div className="border-t mt-8 pt-6">
          <h3 className="font-bold mb-2">Đổi mật khẩu</h3>
          <p className="text-sm text-slate-500 mb-4">Sau khi đổi mật khẩu, bạn cần đăng nhập lại.</p>
          <form className="max-w-lg space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            setPasswordError('');
            if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
              setPasswordError('Mật khẩu mới cần 8–72 ký tự, có chữ và số.'); return;
            }
            if (newPassword !== confirmPassword) { setPasswordError('Mật khẩu xác nhận không khớp.'); return; }
            if (newPassword === currentPassword) { setPasswordError('Mật khẩu mới cần khác mật khẩu hiện tại.'); return; }
            setChangingPassword(true);
            try {
              await changePassword(currentPassword, newPassword);
              logout();
              navigate('/login', { state: { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' } });
            } catch (error) {
              setPasswordError(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.');
            } finally { setChangingPassword(false); }
          }}>
            <label className="form-label" htmlFor="current-password">
              Mật khẩu hiện tại
              <input id="current-password" className="field" type="password" autoComplete="current-password"
                required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="form-label">Mật khẩu mới<input className="field" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <label className="form-label">Xác nhận mật khẩu mới<input className="field" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-primary" disabled={changingPassword}>{changingPassword ? 'Đang lưu...' : 'Đổi mật khẩu'}</button>
              <Link to="/forgot-password" state={{ email: user.email }} className="btn-outline">
                Quên mật khẩu?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AccountShell>
  );
}
export function AddressesPage() {
  const user = useAuthStore((state) => state.user)!;
  const client = useQueryClient();
  const { data: addresses = [], isLoading, error } = useQuery({
    queryKey: ['addresses', user.id],
    queryFn: () => addressService.list(user.id),
  });
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const refresh = () => client.invalidateQueries({ queryKey: ['addresses', user.id] });
  const save = async (entry: Address) => {
    await addressService.save(user.id, {
      ...entry, id: editing?.id, isDefault: entry.isDefault ?? !addresses.length,
    });
    await refresh();
    setActionError('');
    setOpen(false);
    setEditing(null);
  };
  return (
    <AccountShell>
      <div className="panel">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Sổ địa chỉ</h2>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Thêm địa chỉ
          </button>
        </div>
        {actionError && <p className="field-error mb-4">{actionError}</p>}
        {error && <p className="field-error mb-4">Không tải được sổ địa chỉ.</p>}
        {isLoading && <p className="text-sm text-slate-500 mb-4">Đang tải địa chỉ...</p>}
        {addresses.length ? (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div
                key={address.id}
                className="border border-[#e5e5e5] bg-white p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all hover:border-ink"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-bold text-ink">{address.recipientName}</strong>
                    <span className="text-xs text-[#767676]">({address.phone})</span>
                    {address.isDefault && (
                      <span className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                        Mặc định
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#555] leading-relaxed">
                    {address.detail}, {address.ward}{address.district ? `, ${address.district}` : ''}, {address.province}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#eee]">
                  <button
                    type="button"
                    className="font-bold text-ink hover:text-brand underline"
                    onClick={() => {
                      setEditing(address);
                      setOpen(true);
                    }}
                  >
                    Sửa
                  </button>
                  <span className="text-[#ccc]">|</span>
                  <button
                    type="button"
                    className="font-bold text-[#888] hover:text-brand underline"
                    onClick={async () => {
                      if (!confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
                      try {
                        await addressService.remove(user.id, address.id!);
                        await refresh();
                      } catch (reason) {
                        setActionError(reason instanceof Error ? reason.message : 'Không xóa được địa chỉ.');
                      }
                    }}
                  >
                    Xóa
                  </button>
                  {!address.isDefault && (
                    <>
                      <span className="text-[#ccc]">|</span>
                      <button
                        type="button"
                        className="font-bold text-brand hover:underline"
                        onClick={async () => {
                          try {
                            await addressService.save(user.id, { ...address, isDefault: true });
                            await refresh();
                          } catch (reason) {
                            setActionError(reason instanceof Error ? reason.message : 'Không đặt được mặc định.');
                          }
                        }}
                      >
                        Đặt làm mặc định
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Chưa có địa chỉ" description="Thêm địa chỉ để thanh toán nhanh hơn." />
        )}
        {open && <AddressForm initial={editing} onSave={save} onCancel={() => setOpen(false)} />}
      </div>
    </AccountShell>
  );
}
function AddressForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Address | null;
  onSave: (address: Address) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Address>(
    initial ?? { recipientName: '', phone: '', province: '', ward: '', detail: '' },
  );
  const [error, setError] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.recipientName.trim().length < 2 || form.recipientName.length > 150
            || !/^0[0-9]{9}$/.test(form.phone) || !form.detail.trim()
            || form.detail.length > 300) {
            setError('Kiểm tra tên người nhận, số điện thoại và địa chỉ chi tiết.'); return;
          }
          if (!isValidDivision(form.province, form.ward)) {
            setError('Vui lòng chọn tỉnh/thành phố và phường/xã trong danh sách mới.');
            return;
          }
          void onSave({ ...form, district: null }).catch((reason) =>
            setError(reason instanceof Error ? reason.message : 'Không lưu được địa chỉ.'),
          );
        }}
        className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-xl font-bold mb-5">{initial ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</h3>
        {error && <p className="field-error mb-3">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['recipientName', 'Người nhận'],
              ['phone', 'Số điện thoại'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="form-label">
              {label}
              <input
                required
                className="field"
                maxLength={key === 'phone' ? 10 : 150}
                pattern={key === 'phone' ? '0[0-9]{9}' : undefined}
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
          <ProvinceWardFields province={form.province} ward={form.ward}
            onProvinceChange={(province) => setForm({ ...form, province, ward: '' })}
            onWardChange={(ward) => setForm({ ...form, ward })} />
          <label className="form-label md:col-span-2">
            Địa chỉ chi tiết
            <input required maxLength={300} className="field" value={form.detail}
              onChange={(event) => setForm({ ...form, detail: event.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Hủy
          </button>
          <button className="btn-primary">Lưu địa chỉ</button>
        </div>
      </form>
    </div>
  );
}
export function OrdersPage() {
  const user = useAuthStore((state) => state.user)!;
  const [params, setParams] = useSearchParams();
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: () => orderService.list(user?.id),
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  });
  const status = params.get('status') ?? '';
  const items = data?.filter((item) => !status || item.status === status) ?? [];
  return (
    <AccountShell>
      <div className="panel">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Đơn hàng của tôi</h2>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="text-xs text-slate-500 hover:text-brand flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded transition-colors"
              title="Đồng bộ lại danh sách đơn hàng"
            >
              <RefreshCw size={12} className={isFetching ? 'animate-spin text-brand' : ''} />
              <span>{isFetching ? 'Đang cập nhật...' : 'Đồng bộ'}</span>
            </button>
          </div>
          <select
            className="field w-48"
            value={status}
            onChange={(event) =>
              setParams(event.target.value ? { status: event.target.value } : {})
            }
          >
            <option value="">Tất cả trạng thái</option>
            {(
              [
                'PENDING',
                'CONFIRMED',
                'PROCESSING',
                'SHIPPING',
                'DELIVERED',
                'CANCELLED',
              ] as OrderStatus[]
            ).map((item) => (
              <option key={item} value={item}>
                {formatOrderStatus(item)}
              </option>
            ))}
          </select>
        </div>
        {isLoading ? (
          <p>Đang tải đơn hàng...</p>
        ) : error ? (
          <ErrorState error={error} />
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((order) => {
              const firstItem = order.items[0];
              const productUrl = firstItem
                ? `/products/${firstItem.productSlug || firstItem.productId}`
                : `/account/orders/${order.id}`;
              return (
                <div
                  key={order.id}
                  className="border rounded p-4 hover:border-brand transition-colors bg-white"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-sm mb-3">
                    <Link
                      to={`/account/orders/${order.id}`}
                      className="hover:text-brand font-bold"
                    >
                      <strong>{order.orderCode}</strong>
                    </Link>
                    <span className="text-brand font-semibold">{formatOrderStatus(order.status)}</span>
                  </div>
                  {(order.paymentMethod === 'PAYOS' || order.paymentStatus === 'PAID') &&
                    <div className="mb-3 flex items-center gap-2">
                      <PaymentStatusBadge order={order} />
                      {order.paymentStatus === 'PENDING' && <Link className="text-sm font-semibold text-brand underline" to={`/account/orders/${order.id}`}>Xem mã QR</Link>}
                    </div>}
                  <div className="flex items-center gap-3">
                    <Link
                      to={productUrl}
                      className="shrink-0 hover:opacity-80 transition-opacity"
                      title={firstItem ? `Xem chi tiết ${firstItem.productName}` : 'Xem đơn hàng'}
                    >
                      <img
                        src={firstItem?.imageUrl}
                        alt={firstItem?.productName || ''}
                        onError={showProductPlaceholder}
                        className="w-16 h-20 object-cover rounded"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={productUrl}
                        className="font-bold text-ink hover:text-brand hover:underline line-clamp-1 block"
                        title={firstItem ? `Xem chi tiết ${firstItem.productName}` : 'Xem đơn hàng'}
                      >
                        {firstItem?.productName}
                      </Link>
                      <Link
                        to={`/account/orders/${order.id}`}
                        className="text-sm text-slate-500 hover:text-ink hover:underline block mt-0.5"
                      >
                        {formatDate(order.createdAt)} · {order.items.length} sản phẩm
                      </Link>
                    </div>
                    <div className="text-right shrink-0">
                      <strong className="block">{formatCurrency(order.totalAmount)}</strong>
                      <Link
                        to={`/account/orders/${order.id}`}
                        className="text-xs text-brand hover:underline mt-1 inline-block font-medium"
                      >
                        Chi tiết đơn →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Chưa có đơn hàng"
            action={
              <Link to="/products" className="btn-primary inline-block">
                Mua sắm ngay
              </Link>
            }
          />
        )}
      </div>
    </AccountShell>
  );
}
export function OrderDetailPage() {
  const { orderId } = useParams();
  const [params, setParams] = useSearchParams();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const client = useQueryClient();
  const {
    data: order,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.byId(orderId!),
    enabled: !!orderId,
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  });
  const mutation = useMutation({
    mutationFn: () => orderService.cancel(orderId!),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['order', orderId] });
      void client.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const { data: myReviews = [] } = useQuery({
    queryKey: ['my-reviews', orderId],
    queryFn: () => reviewService.mine(orderId!),
    enabled: !!orderId && order?.status === 'DELIVERED',
  });
  useEffect(() => {
    if (params.get('payment') !== 'qr' || !order || order.id !== orderId) return;
    if (order.paymentMethod === 'PAYOS' && order.paymentStatus === 'PENDING') setPaymentOpen(true);
    const next = new URLSearchParams(params);
    next.delete('payment');
    setParams(next, { replace: true });
  }, [params, setParams, order, orderId]);
  return (
    <AccountShell>
      {error ? (
        <ErrorState error={error} />
      ) : !order ? (
        <p>Đang tải...</p>
      ) : (
        <div className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <Link to="/account/orders" className="text-sm text-brand font-medium hover:underline">
                ← Đơn hàng
              </Link>
              <h2 className="text-xl font-bold mt-2">{order.orderCode}</h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="btn-outline flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 min-w-[96px]"
                title="Đồng bộ cập nhật trạng thái mới nhất"
              >
                <RefreshCw size={13} className={isFetching ? 'animate-spin text-brand' : ''} />
                <span>{isFetching ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowInvoice(true)}
                className="btn-outline flex items-center gap-1.5 text-xs py-1.5 px-3"
                title="Xem & in hóa đơn mua hàng"
              >
                <Printer size={14} />
                <span>In hóa đơn</span>
              </button>
              <span className="text-brand font-semibold">{formatOrderStatus(order.status)}</span>
              <PaymentStatusBadge order={order} />
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-6">Đặt ngày {formatDate(order.createdAt)}</p>
          {order.items.map((item) => {
            const productUrl = `/products/${item.productSlug || item.productId}`;
            return (
              <div key={item.id} className="flex items-center gap-4 border-t py-4">
                <Link
                  to={productUrl}
                  className="shrink-0 hover:opacity-80 transition-opacity"
                  title={`Xem chi tiết ${item.productName}`}
                >
                  <img
                    src={getCardImageUrl(item.imageUrl)}
                    alt={item.productName}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (item.imageUrl && target.src !== item.imageUrl) {
                        target.src = item.imageUrl;
                      } else {
                        showProductPlaceholder(e);
                      }
                    }}
                    className="w-16 h-20 object-cover rounded"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={productUrl}
                    className="font-bold text-ink hover:text-brand hover:underline inline-block"
                    title={`Xem chi tiết ${item.productName}`}
                  >
                    <strong>{item.productName}</strong>
                  </Link>
                  <p className="text-sm text-slate-500">
                    {item.color} / {item.size} · SL: {item.quantity}
                  </p>
                  {order.status === 'DELIVERED' && (
                    <button
                      type="button"
                      onClick={() => setReviewItem(item)}
                      className="text-sm text-brand font-semibold hover:underline mt-2 block"
                    >
                      {myReviews.some((review) => review.orderItemId === item.id)
                        ? 'Xem đánh giá của bạn'
                        : 'Đánh giá sản phẩm'}
                    </button>
                  )}
                </div>
                <span className="shrink-0 font-medium">{formatCurrency(item.lineTotal)}</span>
              </div>
            );
          })}
          <div className="border-t pt-5 grid md:grid-cols-2 gap-7 text-sm">
            <div>
              <h3 className="font-bold mb-2">Giao đến</h3>
              <p>
                {order.shippingAddress.recipientName} · {order.shippingAddress.phone}
              </p>
              <p>
                {order.shippingAddress.detail}, {order.shippingAddress.ward},{' '}
                {order.shippingAddress.district ? `${order.shippingAddress.district}, ` : ''}{order.shippingAddress.province}
              </p>
              <p className="mt-2">Thanh toán: {order.paymentMethod === 'PAYOS' ? 'Chuyển khoản qua PayOS' : 'Thanh toán khi nhận hàng (COD)'}</p>
              {order.paymentMethod === 'PAYOS' && <div className="mt-3 flex items-center gap-2">
                <span>Trạng thái thanh toán:</span><PaymentStatusBadge order={order} />
              </div>}
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span>Tạm tính</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Vận chuyển</span>
                <span>{formatCurrency(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span className="text-brand">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </div>
          {order.paymentMethod === 'PAYOS' && order.paymentStatus === 'PENDING' && (
            <button type="button" className="btn-primary mt-5" onClick={() => setPaymentOpen(true)}>Thanh toán đơn hàng</button>
          )}
          {order.paymentMethod === 'PAYOS' && order.paymentStatus === 'PENDING' &&
            <p role="status" className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">Đơn này chưa được thanh toán. Quét mã QR để hoàn tất hoặc hủy đơn nếu bạn không muốn tiếp tục.</p>}
          <div className="flex items-center justify-between mt-7 mb-3">
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-ink text-base">Lịch sử xử lý</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Tự động đồng bộ
              </span>
            </div>
            {isFetching && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <RefreshCw size={11} className="animate-spin text-brand" /> Đang cập nhật...
              </span>
            )}
          </div>
          <OrderTimeline history={order.history} />
          {['PENDING', 'CONFIRMED'].includes(order.status) && (
            <button
              onClick={() => {
                if (window.confirm('Bạn muốn hủy đơn hàng này?')) mutation.mutate();
              }}
              className="btn-outline mt-6"
            >
              Hủy đơn hàng
            </button>
          )}
          {mutation.error && <p className="field-error mt-2">{mutation.error.message}</p>}
          {showInvoice && (
            <OrderInvoiceModal
              order={order}
              onClose={() => setShowInvoice(false)}
            />
          )}
          {paymentOpen && orderId && <PayosPaymentModal orderId={orderId} onClose={() => { setPaymentOpen(false); void refetch(); }} />}
          {reviewItem && <ReviewEditor key={reviewItem.id} item={reviewItem} existing={myReviews.find((review) => review.orderItemId === reviewItem.id)} onClose={() => setReviewItem(null)} />}
        </div>
      )}
    </AccountShell>
  );
}
export function WishlistPage() {
  const ids = useWishlistStore((state) => state.ids);
  const replaceIds = useWishlistStore((state) => state.replaceIds);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['wishlist-products', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const legacy = useDbCatalog ? getMockProducts() : [];
      const results = await Promise.allSettled(ids.map(async (id) => {
        const oldProduct = legacy.find((item) => item.id === id);
        const product = oldProduct
          ? await productService.bySlug(oldProduct.slug)
          : await productService.byId(id);
        return { product, oldId: id };
      }));
      const found = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
      if (!found.length) {
        const failure = results.find((result) => result.status === 'rejected');
        if (failure?.status === 'rejected') throw failure.reason;
      }
      return {
        products: found.map(({ product }) => product),
        replacements: Object.fromEntries(found
          .filter(({ product, oldId }) => product.id !== oldId)
          .map(({ product, oldId }) => [oldId, product.id])),
      };
    },
  });
  useEffect(() => {
    if (data && Object.keys(data.replacements).length) replaceIds(data.replacements);
  }, [data, replaceIds]);
  const products = data?.products ?? [];
  return (
    <div className="container-shell py-10">
      <PageHeading eyebrow="SAVED FOR LATER" title="Sản phẩm yêu thích" />
      {isLoading ? (
        <ProductSkeleton />
      ) : error ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : products.length ? (
        <ProductGrid products={products} />
      ) : (
        <EmptyState
          title="Chưa có sản phẩm yêu thích"
          action={
            <Link className="btn-primary inline-block" to="/products">
              Khám phá sản phẩm
            </Link>
          }
        />
      )}
    </div>
  );
}
