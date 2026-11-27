import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MapPin, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { EmptyState, PageHeading } from '../../components/common';
import { ProvinceWardFields, isValidDivision } from '../../components/ProvinceWardFields';
import { orderService, paymentMethodLabel, shippingFeeFor } from '../../services/orders';
import { loyaltyService } from '../../services/loyalty';
import { productService } from '../../services/catalog';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { cartSubtotal, formatCurrency } from '../../utils/format';
import { getCardImageUrl, showProductPlaceholder } from '../../utils/images';
import { useQuery } from '@tanstack/react-query';
import { readLocal } from '../../services/storage';
import { readCheckoutDraft, saveCheckoutDraft } from '../../services/checkoutDraft';
import { addressService, sameAddress } from '../../services/addresses';
import { PayosPaymentModal } from '../../components/PayosPaymentModal';
import { useDbAuth, useDbCatalog, useDbOrders } from '../../services/httpClient';
import type { Address } from '../../types/models';
const checkoutSchema = z.object({
  recipientName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(150, 'Họ tên tối đa 150 ký tự'),
  phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số'),
  province: z.string().min(2, 'Chọn tỉnh/thành phố'),
  ward: z.string().min(2, 'Chọn phường/xã'),
  detail: z.string().trim().min(5, 'Nhập địa chỉ chi tiết').max(300, 'Địa chỉ tối đa 300 ký tự'),
  note: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự').optional(),
}).refine((value) => isValidDivision(value.province, value.ward), {
  path: ['ward'], message: 'Chọn phường/xã thuộc tỉnh/thành phố đã chọn',
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
        eyebrow="GIỎ HÀNG"
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
              <article key={item.id} className="panel flex gap-4">
                <input
                  aria-label={`Chọn ${item.productName}`}
                  type="checkbox"
                  checked={item.selected}
                  onChange={() => toggle(item.id)}
                  className="accent-brand self-center"
                />
                <Link to={`/products/${item.productSlug}`} className="shrink-0">
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
                    <p className="field-error mt-2">Số lượng này hiện chưa đủ hàng.</p>
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
                {shippingFeeFor(subtotal) === 0 ? 'Miễn phí' : formatCurrency(shippingFeeFor(subtotal))}
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
              Giá và số lượng sẽ được kiểm tra khi bạn đặt hàng.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
export function CheckoutPage() {
  const cartItems = useCartStore((state) => state.items);
  const items = cartItems.filter((item) => item.selected);
  const removeSelected = useCartStore((state) => state.removeSelected);
  const syncProduct = useCartStore((state) => state.syncProduct);
  const productIds = [...new Set(items.map((item) => item.productId))];
  const { data: currentProducts, isPending: checkingPrices, error: pricingError } = useQuery({
    queryKey: ['checkout-current-products', productIds],
    queryFn: () => Promise.all(productIds.map((id) => productService.byId(id))),
    enabled: useDbCatalog && productIds.length > 0,
  });
  useEffect(() => { currentProducts?.forEach(syncProduct); }, [currentProducts, syncProduct]);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [serverError, setServerError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [rememberAddress, setRememberAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'PAYOS'>('COD');
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const addressPrefilled = useRef(false);
  const checkoutKey = useRef(crypto.randomUUID());
  const { data: addresses = [], isLoading: addressesLoading, error: addressesError } = useQuery({
    queryKey: ['addresses', user?.id],
    queryFn: () => addressService.list(user!.id),
    enabled: Boolean(user),
  });
  const saved = user && !useDbAuth
    ? readLocal<Address[]>(`fashionhub_addresses_${user.id}`, []).find(
        (address) => address.isDefault,
      )
    : undefined;
  const draft = user && !useDbAuth ? readCheckoutDraft(user.id) : null;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof checkoutSchema>>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      recipientName: draft?.recipientName ?? saved?.recipientName ?? user?.fullName ?? '',
      phone: draft?.phone ?? saved?.phone ?? user?.phone ?? '',
      province: draft?.province ?? saved?.province ?? '',
      ward: draft?.ward ?? saved?.ward ?? '',
      detail: draft?.detail ?? saved?.detail ?? '',
      note: draft?.note ?? '',
    },
  });
  useEffect(() => {
    if (!user || useDbAuth) return;
    const subscription = watch((value) => {
      saveCheckoutDraft(user.id, {
        recipientName: value.recipientName ?? '',
        phone: value.phone ?? '',
        province: value.province ?? '',
        ward: value.ward ?? '',
        detail: value.detail ?? '',
        note: value.note ?? '',
      });
    });
    return () => subscription.unsubscribe();
  }, [user, watch]);
  useEffect(() => {
    if (!addresses.length || addressPrefilled.current) return;
    addressPrefilled.current = true;
    const address = addresses.find((item) => item.isDefault) ?? addresses[0];
    const current = getValues();
    reset({
      recipientName: current.recipientName || address.recipientName,
      phone: current.phone || address.phone,
      province: current.province || address.province,
      ward: current.ward || address.ward,
      detail: current.detail || address.detail,
      note: current.note,
    });
    setSelectedAddressId(address.id ?? '');
  }, [addresses, getValues, reset]);
  const saveCurrentAddress = async (address: Address) => {
    if (!user) return;
    const existing = addresses.find((item) => sameAddress(item, address));
    if (existing) {
      setSelectedAddressId(existing.id ?? '');
      return existing;
    }
    const savedAddress = await addressService.save(user.id, {
      ...address, isDefault: addresses.length === 0,
    });
    await client.invalidateQueries({ queryKey: ['addresses', user.id] });
    setSelectedAddressId(savedAddress.id ?? '');
    return savedAddress;
  };
  const subtotal = cartSubtotal(items);
  const tierQuote = useQuery({ queryKey: ['loyalty-quote', subtotal], queryFn: () => loyaltyService.quote(subtotal), enabled: useDbOrders && subtotal > 0 });
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
            let confirmedItems = items;
            if (useDbCatalog) {
              const fresh = await Promise.all(productIds.map((id) => productService.byId(id)));
              fresh.forEach(syncProduct);
              confirmedItems = useCartStore.getState().items.filter((item) => item.selected);
              if (confirmedItems.some((item) => item.unitPrice >
                  (items.find((old) => old.variantId === item.variantId)?.unitPrice ?? 0))) {
                setServerError('Giá sản phẩm đã thay đổi. Vui lòng xem lại tổng tiền rồi xác nhận lần nữa.');
                return;
              }
            }
            if (rememberAddress && user) await saveCurrentAddress(address);
            const order = await orderService.create({ userId: user.id, items: confirmedItems, address, note,
              paymentMethod, idempotencyKey: checkoutKey.current });
            if (paymentMethod === 'PAYOS') {
              setPaymentOrderId(order.id);
              return;
            }
            removeSelected();
            await client.invalidateQueries();
            navigate(`/checkout/success/${order.id}`);
          } catch (error) {
            setServerError(error instanceof Error ? error.message : 'Đặt hàng thất bại.');
          }
        })}
        className="grid lg:grid-cols-[1fr_360px] gap-6"
      >
        <div className="panel">
          <h2 className="text-xl font-bold mb-5">Thông tin nhận hàng</h2>
          {user ? (
            <div className="mb-6 p-4 sm:p-5 bg-[#fafafa] border border-[#e5e5e5]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#eee]">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-brand" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-ink">
                    ĐỊA CHỈ NHẬN HÀNG ĐÃ LƯU ({addresses.length})
                  </span>
                </div>
                <Link
                  to="/account/addresses"
                  target="_blank"
                  className="text-xs text-[#666] hover:text-brand underline font-medium"
                >
                  Quản lý sổ địa chỉ →
                </Link>
              </div>

              {addresses.length > 0 ? (
                <div>
                  <label className="form-label text-[11px] text-[#555]">
                    Chọn địa chỉ từ danh sách đã lưu để tự động điền:
                    <select
                      className="field mt-1.5 bg-white font-medium cursor-pointer"
                      value={selectedAddressId}
                      onChange={(event) => {
                        const id = event.target.value;
                        setSelectedAddressId(id);
                        if (!id) return;
                        const address = addresses.find((item) => item.id === id);
                        if (address) {
                          reset({
                            recipientName: address.recipientName,
                            phone: address.phone,
                            province: address.province,
                            ward: address.ward,
                            detail: address.detail,
                            note: getValues('note'),
                          });
                        }
                      }}
                    >
                      <option value="">+ Nhập địa chỉ mới / Tùy chỉnh</option>
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.isDefault ? '★ [Mặc định] ' : ''}
                          {address.recipientName} ({address.phone}) — {address.detail}, {address.ward}, {address.province}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-[#666] leading-relaxed">
                  Bạn chưa có địa chỉ lưu sẵn. Điền thông tin giao hàng bên dưới và bấm nút <strong>"Lưu vào sổ địa chỉ"</strong> để tự động sử dụng cho các lần mua sắm tiếp theo.
                </p>
              )}

              {addressesLoading && <p className="text-xs text-slate-500 mt-2">Đang tải sổ địa chỉ...</p>}
              {addressesError && <p className="field-error mt-2">Không tải được sổ địa chỉ.</p>}

              <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-[#eee]">
                <button
                  type="button"
                  className="btn-outline py-2 px-3 text-xs bg-white font-bold"
                  onClick={async () => {
                    const valid = await trigger([
                      'recipientName', 'phone', 'province', 'ward', 'detail',
                    ]);
                    if (!valid) return;
                    setServerError('');
                    try {
                      await saveCurrentAddress(getValues());
                      setSaveSuccess('Đã lưu địa chỉ thành công vào sổ địa chỉ!');
                      setTimeout(() => setSaveSuccess(''), 4000);
                    } catch (error) {
                      setServerError(error instanceof Error ? error.message : 'Không lưu được địa chỉ.');
                    }
                  }}
                >
                  Lưu địa chỉ hiện tại vào sổ địa chỉ
                </button>
                {saveSuccess && (
                  <span className="text-xs text-green-700 font-bold flex items-center gap-1">
                    <CheckCircle2 size={15} /> {saveSuccess}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-[#f8f8f8] border border-[#e5e5e5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-[#555]">
                <strong className="text-ink font-bold block mb-0.5">Bạn đã có tài khoản thành viên?</strong>
                Đăng nhập để tự động điền địa chỉ nhận hàng đã lưu và theo dõi đơn hàng dễ dàng.
              </div>
              <Link
                to="/login"
                state={{ from: '/checkout' }}
                className="btn-outline py-2 px-4 text-xs whitespace-nowrap bg-white font-bold"
              >
                ĐĂNG NHẬP NGAY →
              </Link>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {(
              [
                ['recipientName', 'Họ tên người nhận'],
                ['phone', 'Số điện thoại'],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="form-label">
                {label}
                <input className="field" {...register(name, {
                  onChange: () => setSelectedAddressId(''),
                })} />
                {errors[name] && <span className="field-error">{errors[name]?.message}</span>}
              </label>
            ))}
            <ProvinceWardFields province={watch('province')} ward={watch('ward')}
              onProvinceChange={(province) => {
                setValue('province', province, { shouldValidate: true });
                setValue('ward', '', { shouldValidate: true });
                setSelectedAddressId('');
              }}
              onWardChange={(ward) => {
                setValue('ward', ward, { shouldValidate: true });
                setSelectedAddressId('');
              }}
              provinceError={errors.province?.message} wardError={errors.ward?.message} />
            <label className="form-label md:col-span-2">
              Địa chỉ chi tiết
              <input className="field" {...register('detail', {
                onChange: () => setSelectedAddressId(''),
              })} />
              {errors.detail && <span className="field-error">{errors.detail.message}</span>}
            </label>
          </div>
          <label className="form-label mt-5">
            Ghi chú đơn hàng
            <textarea
              className="field min-h-24"
              {...register('note')}
              placeholder="Lưu ý cho người giao hàng (nếu có)"
            />
          </label>
          <div className="bg-[#fafafa] border border-[#e5e5e5] p-5 mt-6">
            <div className="text-xs font-extrabold uppercase tracking-wider text-ink mb-1">
              Phương thức thanh toán
            </div>
            <div className="mt-3 grid gap-3">
              <label className={`flex cursor-pointer gap-3 border p-4 ${paymentMethod === 'COD' ? 'border-brand bg-red-50' : 'border-slate-200 bg-white'}`}>
                <input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === 'COD'}
                  onChange={() => setPaymentMethod('COD')} className="mt-1 accent-brand" />
                <span><strong className="block text-sm">Thanh toán khi nhận hàng (COD)</strong>
                  <span className="mt-1 block text-xs text-slate-600">Thanh toán cho nhân viên giao hàng khi nhận kiện.</span></span>
              </label>
              <label className={`flex gap-3 border p-4 ${paymentMethod === 'PAYOS' ? 'border-brand bg-red-50' : 'border-slate-200 bg-white'} ${!useDbOrders ? 'opacity-60' : 'cursor-pointer'}`}>
                <input type="radio" name="paymentMethod" value="PAYOS" checked={paymentMethod === 'PAYOS'}
                  disabled={!useDbOrders} onChange={() => setPaymentMethod('PAYOS')} className="mt-1 accent-brand" />
                <span><strong className="block text-sm">Chuyển khoản ngân hàng qua PayOS</strong>
                  <span className="mt-1 block text-xs text-slate-600">Mở trang thanh toán PayOS để quét mã QR hoặc chuyển khoản. Đơn chỉ được xác nhận sau khi hệ thống ghi nhận thanh toán.</span>
                  {!useDbOrders && <span className="mt-1 block text-xs text-amber-700">Cần kết nối hệ thống đơn hàng để sử dụng.</span>}</span>
              </label>
            </div>
          </div>
          {user ? (
            <label className="flex items-center gap-2.5 text-xs font-bold text-ink cursor-pointer select-none mt-4 p-3.5 bg-[#fafafa] border border-[#eee]">
              <input
                type="checkbox"
                className="w-4 h-4 accent-brand cursor-pointer"
                checked={rememberAddress}
                onChange={(event) => setRememberAddress(event.target.checked)}
              />
              <span>Ghi nhớ và lưu địa chỉ này vào sổ địa chỉ cho các đơn hàng sau</span>
            </label>
          ) : (
            <p className="text-xs text-slate-500 mt-3">
              Thông tin nhận hàng và ghi chú được lưu trên trình duyệt này cho lần đặt tiếp theo.
            </p>
          )}
        </div>
        <aside className="summary-card h-fit">
          <h2 className="text-xl font-bold mb-5">Đơn hàng của bạn</h2>
          {items.map((item) => {
            const productUrl = `/products/${item.productSlug || item.productId}`;
            return (
              <div key={item.id} className="flex gap-3 border-b py-3">
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
                    className="w-14 h-16 object-cover rounded"
                  />
                </Link>
                <div className="text-sm flex-1 min-w-0">
                  <Link
                    to={productUrl}
                    className="hover:text-brand hover:underline font-bold text-ink inline-block"
                    title={`Xem chi tiết ${item.productName}`}
                  >
                    <strong className="line-clamp-2">{item.productName}</strong>
                  </Link>
                  <p className="text-slate-500">
                    {item.color} / {item.size} × {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between text-sm mt-5">
            <span>Tạm tính</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm mt-3">
            <span>Vận chuyển</span>
            <span>{formatCurrency(shippingFeeFor(subtotal))}</span>
          </div>
          {(tierQuote.data?.discountAmount ?? 0) > 0 && <div className="flex justify-between text-sm mt-3 text-brand"><span>Ưu đãi thành viên</span><span>−{formatCurrency(tierQuote.data!.discountAmount)}</span></div>}
          <div className="flex justify-between font-bold text-lg mt-5 pt-5 border-t">
            <span>Tổng dự kiến</span>
            <span className="text-brand">
              {formatCurrency(subtotal + shippingFeeFor(subtotal) - (tierQuote.data?.discountAmount ?? 0))}
            </span>
          </div>
          {pricingError && <p className="field-error mt-4">Không cập nhật được giá sản phẩm. Vui lòng thử lại.</p>}
          {serverError && <p className="field-error mt-4">{serverError}</p>}
          <button disabled={isSubmitting || (useDbCatalog && (checkingPrices || !!pricingError))} className="btn-primary w-full mt-6">
            {isSubmitting ? 'Đang xử lý...' : paymentMethod === 'PAYOS' ? 'Đặt hàng và hiện mã QR' : 'Xác nhận đặt hàng'}
          </button>
          <p className="text-xs text-slate-500 mt-3">
            Máy chủ xác nhận giá và tồn kho trước khi ghi nhận đơn.
          </p>
        </aside>
      </form>
      {paymentOrderId && <PayosPaymentModal orderId={paymentOrderId}
        onClose={() => { removeSelected(); navigate(`/account/orders/${paymentOrderId}`); }} />}
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
              Thanh toán: <strong>{paymentMethodLabel(order.paymentMethod)}</strong>
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

export function PaymentReturnPage({ cancelled = false }: { cancelled?: boolean }) {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const { data: order, error, isPending, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.byId(orderId!),
    enabled: !!orderId && useDbOrders,
    refetchInterval: (query) => query.state.data?.paymentStatus === 'PENDING' ? 4000 : false,
    refetchOnWindowFocus: 'always',
  });
  const paid = order?.paymentStatus === 'PAID';
  return <div className="container-shell py-16">
    <div className="mx-auto max-w-xl bg-white p-8 text-center md:p-12">
      <CheckCircle2 size={52} className={`mx-auto mb-5 ${paid ? 'text-emerald-600' : 'text-slate-400'}`} />
      <h1 className="text-2xl font-bold">
        {paid ? 'Đã nhận thanh toán' : cancelled ? 'Bạn đã rời trang thanh toán' : 'Đang kiểm tra thanh toán'}
      </h1>
      {!orderId || !useDbOrders ? <p className="mt-3 text-slate-600">Không tìm thấy mã đơn hàng để kiểm tra. Bạn có thể xem trạng thái trong tài khoản.</p> :
        error ? <p className="mt-3 text-red-700">Chưa tải được trạng thái đơn hàng. Vui lòng thử lại.</p> :
        isPending ? <p className="mt-3 text-slate-600">Đang tải thông tin đơn hàng…</p> :
        <div className="mt-5 space-y-2 text-sm text-slate-600">
          <p>Đơn hàng <strong className="text-ink">{order?.orderCode}</strong> · {formatCurrency(order?.totalAmount ?? 0)}</p>
          <p>{paid ? 'Cửa hàng đã xác nhận khoản thanh toán của bạn.' :
            order?.status === 'CANCELLED' ? 'Đơn hàng đã bị hủy.' :
            cancelled ? 'Đơn hàng chưa được thanh toán. Bạn có thể xem lại đơn hàng để tiếp tục hoặc hủy.' :
            'Đơn hàng chưa được xác nhận thanh toán. Trang sẽ tự kiểm tra lại trạng thái.'}</p>
        </div>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {orderId && <Link className="btn-primary" to={`/account/orders/${orderId}`}>Xem đơn hàng</Link>}
        {orderId && <button type="button" className="btn-outline" onClick={() => void refetch()}>Kiểm tra lại</button>}
        <Link className="btn-outline" to="/products">Tiếp tục mua sắm</Link>
      </div>
    </div>
  </div>;
}
