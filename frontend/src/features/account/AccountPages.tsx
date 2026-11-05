import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { EmptyState, ErrorState, PageHeading } from '../../components/common';
import { ProductGrid } from '../../components/ProductCard';
import { getMockProducts } from '../../services/catalog';
import { orderService } from '../../services/orders';
import { readLocal, writeLocal } from '../../services/storage';
import { useAuthStore } from '../../stores/authStore';
import { useWishlistStore } from '../../stores/wishlistStore';
import type { Address, OrderStatus } from '../../types/models';
import { formatCurrency, formatDate, formatOrderStatus } from '../../utils/format';

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
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [message, setMessage] = useState('');
  return (
    <AccountShell>
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
          <p className="text-sm text-slate-500">
            Cần API xác thực Backend để đổi mật khẩu an toàn. Chức năng chưa tích hợp trong chế độ
            demo.
          </p>
        </div>
      </div>
    </AccountShell>
  );
}
export function AddressesPage() {
  const user = useAuthStore((state) => state.user)!;
  const key = `fashionhub_addresses_${user.id}`;
  const [addresses, setAddresses] = useState<Address[]>(() => readLocal(key, []));
  const [editing, setEditing] = useState<Address | null>(null);
  const [open, setOpen] = useState(false);
  const save = (entry: Address) => {
    const next = editing
      ? addresses.map((item) => (item.id === editing.id ? entry : item))
      : [...addresses, { ...entry, id: crypto.randomUUID(), isDefault: !addresses.length }];
    setAddresses(next);
    writeLocal(key, next);
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
        {addresses.length ? (
          <div className="space-y-3">
            {addresses.map((address) => (
              <div key={address.id} className="border rounded p-4 flex justify-between gap-4">
                <div>
                  <strong>{address.recipientName}</strong> · {address.phone}
                  {address.isDefault && <span className="text-brand text-xs ml-2">Mặc định</span>}
                  <p className="text-sm text-slate-500 mt-1">
                    {address.detail}, {address.ward}, {address.district}, {address.province}
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-sm text-brand">
                  <button
                    onClick={() => {
                      setEditing(address);
                      setOpen(true);
                    }}
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => {
                      const next = addresses.filter((item) => item.id !== address.id);
                      setAddresses(next);
                      writeLocal(key, next);
                    }}
                  >
                    Xóa
                  </button>
                  {!address.isDefault && (
                    <button
                      onClick={() => {
                        const next = addresses.map((item) => ({
                          ...item,
                          isDefault: item.id === address.id,
                        }));
                        setAddresses(next);
                        writeLocal(key, next);
                      }}
                    >
                      Đặt mặc định
                    </button>
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
  onSave: (address: Address) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Address>(
    initial ?? { recipientName: '', phone: '', province: '', district: '', ward: '', detail: '' },
  );
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
        className="bg-white p-6 rounded w-full max-w-lg"
      >
        <h3 className="text-xl font-bold mb-5">{initial ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</h3>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['recipientName', 'Người nhận'],
              ['phone', 'Số điện thoại'],
              ['province', 'Tỉnh / Thành phố'],
              ['district', 'Quận / Huyện'],
              ['ward', 'Phường / Xã'],
              ['detail', 'Địa chỉ chi tiết'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="form-label">
              {label}
              <input
                required
                className="field"
                value={form[key]}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
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
  const { data, error, isLoading } = useQuery({
    queryKey: ['orders', user.id],
    queryFn: () => orderService.list(user.id),
  });
  const status = params.get('status') ?? '';
  const items = data?.filter((item) => !status || item.status === status) ?? [];
  return (
    <AccountShell>
      <div className="panel">
        <div className="flex flex-wrap justify-between gap-3 mb-6">
          <h2 className="text-xl font-bold">Đơn hàng của tôi</h2>
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
            {items.map((order) => (
              <Link
                key={order.id}
                to={`/account/orders/${order.id}`}
                className="block border rounded p-4 hover:border-brand"
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm mb-3">
                  <strong>{order.orderCode}</strong>
                  <span className="text-brand">{formatOrderStatus(order.status)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={order.items[0]?.imageUrl}
                    alt=""
                    className="w-16 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p>{order.items[0]?.productName}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(order.createdAt)} · {order.items.length} sản phẩm
                    </p>
                  </div>
                  <strong>{formatCurrency(order.totalAmount)}</strong>
                </div>
              </Link>
            ))}
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
  const client = useQueryClient();
  const { data: order, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.byId(orderId!),
    enabled: !!orderId,
    refetchInterval: (query) =>
      ['PENDING', 'PROCESSING'].includes(query.state.data?.status ?? '') ? 15000 : false,
  });
  const mutation = useMutation({
    mutationFn: () => orderService.updateStatus(orderId!, 'CANCELLED'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['order', orderId] });
      void client.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  return (
    <AccountShell>
      {error ? (
        <ErrorState error={error} />
      ) : !order ? (
        <p>Đang tải...</p>
      ) : (
        <div className="panel">
          <div className="flex flex-wrap justify-between gap-3 mb-5">
            <div>
              <Link to="/account/orders" className="text-sm text-brand">
                ← Đơn hàng
              </Link>
              <h2 className="text-xl font-bold mt-2">{order.orderCode}</h2>
            </div>
            <span className="text-brand font-semibold">{formatOrderStatus(order.status)}</span>
          </div>
          <p className="text-sm text-slate-500 mb-6">Đặt ngày {formatDate(order.createdAt)}</p>
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 border-t py-4">
              <img src={item.imageUrl} alt={item.productName} className="w-16 h-20 object-cover" />
              <div className="flex-1">
                <strong>{item.productName}</strong>
                <p className="text-sm text-slate-500">
                  {item.color} / {item.size} · SL: {item.quantity}
                </p>
              </div>
              <span>{formatCurrency(item.lineTotal)}</span>
            </div>
          ))}
          <div className="border-t pt-5 grid md:grid-cols-2 gap-7 text-sm">
            <div>
              <h3 className="font-bold mb-2">Giao đến</h3>
              <p>
                {order.shippingAddress.recipientName} · {order.shippingAddress.phone}
              </p>
              <p>
                {order.shippingAddress.detail}, {order.shippingAddress.ward},{' '}
                {order.shippingAddress.district}, {order.shippingAddress.province}
              </p>
              <p className="mt-2">Thanh toán: COD</p>
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
          <h3 className="font-bold mt-7 mb-3">Lịch sử xử lý</h3>
          {order.history.map((event) => (
            <p
              key={`${event.status}-${event.at}`}
              className="text-sm border-l-2 border-brand pl-3 py-1"
            >
              {formatOrderStatus(event.status)} · {formatDate(event.at)}
            </p>
          ))}
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
        </div>
      )}
    </AccountShell>
  );
}
export function WishlistPage() {
  const ids = useWishlistStore((state) => state.ids);
  const products = getMockProducts().filter((item) => ids.includes(item.id));
  return (
    <div className="container-shell py-10">
      <PageHeading eyebrow="SAVED FOR LATER" title="Sản phẩm yêu thích" />
      {products.length ? (
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
