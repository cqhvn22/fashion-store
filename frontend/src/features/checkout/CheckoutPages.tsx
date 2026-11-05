import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { EmptyState, PageHeading } from '../../components/common';
import { orderService, shippingFeeFor } from '../../services/orders';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { cartSubtotal, formatCurrency } from '../../utils/format';
import { useQuery } from '@tanstack/react-query';
import { readLocal } from '../../services/storage';
import type { Address } from '../../types/models';
const checkoutSchema = z.object({
  recipientName: z.string().min(2, 'Vui lòng nhập họ tên'),
  phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số'),
  province: z.string().min(2, 'Nhập tỉnh/thành phố'),
  district: z.string().min(2, 'Nhập quận/huyện'),
  ward: z.string().min(2, 'Nhập phường/xã'),
  detail: z.string().min(5, 'Nhập địa chỉ chi tiết'),
  note: z.string().optional(),
});
export function CartPage() {
  const items = useCartStore((state) => state.items);
  const update = useCartStore((state) => state.updateQuantity);
  const toggle = useCartStore((state) => state.toggle);
  const remove = useCartStore((state) => state.remove);
  const selected = items.filter((item) => item.selected);
  const subtotal = cartSubtotal(selected);
  return (
    <div className="container-shell py-10">
      <PageHeading
        eyebrow="YOUR BAG"
        title="Giỏ hàng"
        description={`${items.length} sản phẩm trong giỏ`}
      />
      {items.length === 0 ? (
        <EmptyState
          title="Giỏ hàng đang trống"
          description="Hãy chọn vài món đồ thật hợp với bạn."
          action={
            <Link className="btn-primary inline-block" to="/products">
              Khám phá sản phẩm
            </Link>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="bg-white rounded p-4 flex gap-4">
                <input
                  aria-label={`Chọn ${item.productName}`}
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggle(item.id)}
                  className="accent-brand self-center"
                />
                <Link to={`/products/${item.productSlug}`} className="shrink-0">
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="w-20 h-24 md:w-28 md:h-32 object-cover rounded"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${item.productSlug}`}
                    className="font-semibold hover:text-brand line-clamp-2"
                  >
                    {item.productName}
                  </Link>
                  <p className="text-sm text-slate-500 mt-1">
                    {item.color} / {item.size}
                  </p>
                  <strong className="text-brand block mt-2">
                    {formatCurrency(item.unitPrice)}
                  </strong>
                  <div className="flex justify-between items-center mt-3">
                    <div className="quantity-control">
                      <button aria-label="Giảm" onClick={() => update(item.id, item.quantity - 1)}>
                        <Minus size={14} />
                      </button>
                      <span>{item.quantity}</span>
                      <button aria-label="Tăng" onClick={() => update(item.id, item.quantity + 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      aria-label="Xóa sản phẩm"
                      onClick={() => remove(item.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {item.availableStock !== undefined && item.quantity > item.availableStock && (
                    <p className="field-error mt-2">Số lượng vượt tồn kho.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
          <aside className="summary-card h-fit">
            <h2 className="text-xl font-bold mb-5">Tóm tắt đơn hàng</h2>
            <div className="flex justify-between text-sm mb-3">
              <span>Sản phẩm đã chọn ({selected.length})</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm mb-5">
              <span>Phí vận chuyển dự kiến</span>
              <span>
                {subtotal >= 500000 ? 'Miễn phí' : formatCurrency(shippingFeeFor(subtotal))}
              </span>
            </div>
            <div className="flex justify-between border-t pt-5 font-bold text-lg">
              <span>Tạm tính</span>
              <span className="text-brand">
                {formatCurrency(subtotal + (selected.length ? shippingFeeFor(subtotal) : 0))}
              </span>
            </div>
            <Link
              to="/checkout"
              className={`btn-primary block text-center mt-6 ${!selected.length ? 'pointer-events-none opacity-50' : ''}`}
            >
              Tiến hành thanh toán
            </Link>
            <p className="text-xs text-slate-500 mt-3">
              Giá và tồn kho được xác nhận lại khi đặt hàng.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
export function CheckoutPage() {
  const items = useCartStore((state) => state.items.filter((item) => item.selected));
  const removeSelected = useCartStore((state) => state.removeSelected);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [serverError, setServerError] = useState('');
  const saved = user
    ? readLocal<Address[]>(`fashionhub_addresses_${user.id}`, []).find(
        (address) => address.isDefault,
      )
    : undefined;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      recipientName: saved?.recipientName ?? user?.fullName ?? '',
      phone: saved?.phone ?? user?.phone ?? '',
      province: saved?.province ?? '',
      district: saved?.district ?? '',
      ward: saved?.ward ?? '',
      detail: saved?.detail ?? '',
      note: '',
    },
  });
  const subtotal = cartSubtotal(items);
  if (!items.length)
    return (
      <div className="container-shell py-10">
        <EmptyState
          title="Chưa có sản phẩm để thanh toán"
          action={
            <Link className="btn-primary inline-block" to="/cart">
              Về giỏ hàng
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="container-shell py-10">
      <PageHeading
        eyebrow="CHECKOUT"
        title="Thanh toán"
        description="Vui lòng kiểm tra thông tin trước khi đặt hàng."
      />
      <form
        onSubmit={handleSubmit(async ({ note, ...address }) => {
          if (!user) {
            navigate('/login', { state: { from: '/checkout' } });
            return;
          }
          setServerError('');
          try {
            const order = await orderService.create({ userId: user.id, items, address, note });
            removeSelected();
            await client.invalidateQueries();
            navigate(`/checkout/success/${order.id}`);
          } catch (error) {
            setServerError(error instanceof Error ? error.message : 'Đặt hàng thất bại.');
          }
        })}
        className="grid lg:grid-cols-[1fr_360px] gap-6"
      >
        <div className="bg-white rounded p-6">
          <h2 className="text-xl font-bold mb-5">Thông tin nhận hàng</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {(
              [
                ['recipientName', 'Họ tên người nhận'],
                ['phone', 'Số điện thoại'],
                ['province', 'Tỉnh / Thành phố'],
                ['district', 'Quận / Huyện'],
                ['ward', 'Phường / Xã'],
                ['detail', 'Địa chỉ chi tiết'],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="form-label">
                {label}
                <input className="field" {...register(name)} />
                {errors[name] && <span className="field-error">{errors[name]?.message}</span>}
              </label>
            ))}
          </div>
          <label className="form-label mt-5">
            Ghi chú đơn hàng
            <textarea
              className="field min-h-24"
              {...register('note')}
              placeholder="Lưu ý cho người giao hàng (nếu có)"
            />
          </label>
          <div className="bg-[#fff7f4] p-4 mt-6 rounded">
            <strong>Phương thức thanh toán</strong>
            <p className="text-sm text-slate-600 mt-1">Thanh toán khi nhận hàng (COD)</p>
          </div>
        </div>
        <aside className="summary-card h-fit">
          <h2 className="text-xl font-bold mb-5">Đơn hàng của bạn</h2>
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 border-b py-3">
              <img
                src={item.imageUrl}
                alt={item.productName}
                className="w-14 h-16 object-cover rounded"
              />
              <div className="text-sm flex-1">
                <strong className="line-clamp-2">{item.productName}</strong>
                <p className="text-slate-500">
                  {item.color} / {item.size} × {item.quantity}
                </p>
              </div>
              <span className="text-sm font-medium whitespace-nowrap">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm mt-5">
            <span>Tạm tính</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm mt-3">
            <span>Vận chuyển</span>
            <span>{formatCurrency(shippingFeeFor(subtotal))}</span>
          </div>
          <div className="flex justify-between font-bold text-lg mt-5 pt-5 border-t">
            <span>Tổng dự kiến</span>
            <span className="text-brand">
              {formatCurrency(subtotal + shippingFeeFor(subtotal))}
            </span>
          </div>
          {serverError && <p className="field-error mt-4">{serverError}</p>}
          <button disabled={isSubmitting} className="btn-primary w-full mt-6">
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
          </button>
          <p className="text-xs text-slate-500 mt-3">
            Máy chủ xác nhận giá và tồn kho trước khi ghi nhận đơn.
          </p>
        </aside>
      </form>
    </div>
  );
}
export function SuccessPage() {
  const { orderId } = useParams();
  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.byId(orderId!),
    enabled: !!orderId,
  });
  return (
    <div className="container-shell py-16">
      <div className="max-w-xl mx-auto bg-white text-center p-8 md:p-12 rounded">
        <CheckCircle2 size={58} className="text-green-600 mx-auto mb-5" />
        <h1 className="text-2xl font-bold">Đã ghi nhận đơn hàng!</h1>
        <p className="text-slate-500 mt-3">
          Đơn của bạn đang chờ xác nhận. Theo dõi trạng thái để biết tiến trình xử lý.
        </p>
        {order && (
          <div className="bg-slate-50 rounded p-5 text-left mt-7 space-y-2 text-sm">
            <p>
              Mã đơn: <strong>{order.orderCode}</strong>
            </p>
            <p>
              Tổng tiền: <strong>{formatCurrency(order.totalAmount)}</strong>
            </p>
            <p>
              Thanh toán: <strong>COD</strong>
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-3 mt-7">
          <Link className="btn-primary" to={`/account/orders/${orderId}`}>
            Xem đơn hàng
          </Link>
          <Link className="btn-outline" to="/products">
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  );
}
