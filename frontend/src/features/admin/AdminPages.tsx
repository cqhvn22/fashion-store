import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, EmptyState, ErrorState, PageHeading } from '../../components/common';
import { demoUsers } from '../../mocks/catalog';
import {
  categoryService,
  getMockProducts,
  productService,
  saveMockProducts,
} from '../../services/catalog';
import { knowledgeService, mockConversations } from '../../services/chat';
import { orderService } from '../../services/orders';
import { mockMode } from '../../services/httpClient';
import type { Category, KnowledgeDocument, OrderStatus, Product } from '../../types/models';
import { formatCurrency, formatDate, formatOrderStatus } from '../../utils/format';

export function AdminDashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => orderService.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () =>
      mockMode
        ? Promise.resolve(getMockProducts())
        : productService.list({ limit: 100 }).then((result) => result.content),
  });
  const revenue = orders
    .filter((item) => item.status === 'DELIVERED')
    .reduce((sum, item) => sum + item.totalAmount, 0);
  const lowStock = products.flatMap((item) =>
    item.variants
      .filter((variant) => variant.stockQuantity <= 2)
      .map((variant) => ({ product: item.name, ...variant })),
  );
  const chart = Array.from({ length: 7 }, (_, index) => ({
    day: `T${index + 2}`,
    total: orders
      .filter((item) => new Date(item.createdAt).getDay() === (index + 1) % 7)
      .reduce((sum, item) => sum + item.totalAmount, 0),
  }));
  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Tổng quan cửa hàng"
        description="Số liệu minh họa từ dữ liệu demo hiện tại."
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          ['Sản phẩm', products.length],
          ['Đơn hàng', orders.length],
          ['Chờ xử lý', orders.filter((item) => item.status === 'PENDING').length],
          ['Doanh thu demo', formatCurrency(revenue)],
        ].map(([label, value]) => (
          <div key={label} className="panel">
            <p className="text-slate-500 text-sm">{label}</p>
            <strong className="text-2xl block mt-3">{value}</strong>
          </div>
        ))}
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <div className="panel">
          <h2 className="font-bold text-lg mb-5">Đơn hàng theo ngày</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="total" fill="#ee4d2d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <h2 className="font-bold text-lg mb-5">Đơn hàng gần đây</h2>
          {orders.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              to={`/admin/orders/${item.id}`}
              className="flex justify-between gap-2 border-b py-3 text-sm hover:text-brand"
            >
              <span>{item.orderCode}</span>
              <span>{formatOrderStatus(item.status)}</span>
              <strong>{formatCurrency(item.totalAmount)}</strong>
            </Link>
          ))}
          <Link to="/admin/orders" className="text-brand text-sm inline-block mt-4">
            Xem tất cả →
          </Link>
        </div>
        <div className="panel xl:col-span-2">
          <h2 className="font-bold text-lg mb-4">Cảnh báo tồn kho thấp</h2>
          <div className="grid md:grid-cols-2 gap-2">
            {lowStock.slice(0, 6).map((item) => (
              <div key={item.id} className="border rounded p-3 flex justify-between text-sm">
                <span>
                  {item.product} · {item.color}/{item.size}
                </span>
                <strong className="text-red-600">{item.stockQuantity}</strong>
              </div>
            ))}
          </div>
          <Link to="/admin/inventory" className="text-brand text-sm inline-block mt-4">
            Quản lý tồn kho →
          </Link>
        </div>
      </div>
    </>
  );
}
export function AdminProducts() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const { data: products = [], refetch } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () =>
      mockMode
        ? Promise.resolve(getMockProducts())
        : productService.list({ limit: 100 }).then((result) => result.content),
  });
  const filtered = products.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) && (!status || item.status === status),
  );
  const shown = filtered.slice((page - 1) * 10, page * 10);
  const remove = async (id: string) => {
    if (!window.confirm('Xóa sản phẩm này?')) return;
    await productService.remove(id);
    await client.invalidateQueries();
    void refetch();
  };
  return (
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Quản lý sản phẩm"
        action={
          <Link className="btn-primary" to="/admin/products/create">
            + Thêm sản phẩm
          </Link>
        }
      />
      <div className="panel">
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            className="field max-w-xs"
            placeholder="Tìm tên sản phẩm"
            aria-label="Tìm sản phẩm"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="field w-44"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
            <option value="DRAFT">Bản nháp</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-60">
                      <img
                        src={item.images[0]?.url}
                        alt=""
                        className="w-12 h-14 object-cover rounded"
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td>{categories.find((category) => category.id === item.categoryId)?.name}</td>
                  <td>{formatCurrency(item.minPrice)}</td>
                  <td>
                    <Badge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {item.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <Link className="text-brand" to={`/admin/products/${item.id}/edit`}>
                        Sửa
                      </Link>
                      <button className="text-red-600" onClick={() => void remove(item.id)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <EmptyState title="Không có sản phẩm phù hợp" />}
        <div className="flex justify-end items-center gap-3 mt-5 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Trước
          </button>
          <span>
            {page} / {Math.max(1, Math.ceil(filtered.length / 10))}
          </span>
          <button disabled={page * 10 >= filtered.length} onClick={() => setPage(page + 1)}>
            Sau →
          </button>
        </div>
      </div>
    </>
  );
}
export function AdminProductForm() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const existing = id ? getMockProducts().find((item) => item.id === id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'cat-01');
  const [price, setPrice] = useState(existing?.minPrice ?? 0);
  const [originalPrice, setOriginalPrice] = useState(existing?.originalPrice ?? 0);
  const [imageUrl, setImageUrl] = useState(existing?.images[0]?.url ?? '');
  const [status, setStatus] = useState<Product['status']>(existing?.status ?? 'ACTIVE');
  const [variants, setVariants] = useState(
    existing?.variants ?? [
      { id: crypto.randomUUID(), sku: '', color: 'Đen', size: 'M', price: 0, stockQuantity: 0 },
    ],
  );
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !name ||
      !slug ||
      !imageUrl ||
      price < 1000 ||
      variants.some((item) => !item.sku || item.stockQuantity < 0)
    ) {
      setError('Vui lòng điền đầy đủ thông tin hợp lệ và SKU cho từng biến thể.');
      return;
    }
    const now = new Date().toISOString();
    const product: Product = {
      id: existing?.id ?? crypto.randomUUID(),
      slug,
      name,
      description,
      categoryId,
      images: [
        {
          id: existing?.images[0]?.id ?? crypto.randomUUID(),
          url: imageUrl,
          alt: name,
          isPrimary: true,
        },
      ],
      variants: variants.map((item) => ({ ...item, price })),
      minPrice: price,
      maxPrice: price,
      originalPrice,
      status,
      brand: 'FashionHub',
      ratingAverage: existing?.ratingAverage ?? 0,
      reviewCount: existing?.reviewCount ?? 0,
      soldCount: existing?.soldCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await productService.save(product);
      await client.invalidateQueries();
      navigate('/admin/products');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu sản phẩm.');
    }
  };
  return (
    <>
      <PageHeading title={existing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} eyebrow="CATALOG" />
      <form onSubmit={(event) => void submit(event)} className="panel space-y-5 max-w-4xl">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="form-label">
            Tên sản phẩm
            <input
              required
              className="field"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!existing)
                  setSlug(
                    event.target.value
                      .toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/đ/g, 'd')
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  );
              }}
            />
          </label>
          <label className="form-label">
            Slug
            <input
              required
              className="field"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </label>
          <label className="form-label">
            Danh mục
            <select
              className="field"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Trạng thái
            <select
              className="field"
              value={status}
              onChange={(event) => setStatus(event.target.value as Product['status'])}
            >
              <option value="ACTIVE">Đang bán</option>
              <option value="INACTIVE">Ngừng bán</option>
              <option value="DRAFT">Bản nháp</option>
            </select>
          </label>
          <label className="form-label">
            Giá bán (VND)
            <input
              required
              min={1000}
              type="number"
              className="field"
              value={price}
              onChange={(event) => setPrice(Number(event.target.value))}
            />
          </label>
          <label className="form-label">
            Giá gốc (VND)
            <input
              min={0}
              type="number"
              className="field"
              value={originalPrice}
              onChange={(event) => setOriginalPrice(Number(event.target.value))}
            />
          </label>
        </div>
        <label className="form-label">
          Mô tả
          <textarea
            required
            className="field min-h-28"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="form-label">
          URL ảnh sản phẩm
          <input
            required
            type="url"
            className="field"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
        </label>
        <div>
          <div className="flex justify-between mb-3">
            <h2 className="font-bold">Biến thể & tồn kho</h2>
            <button
              type="button"
              className="text-brand text-sm"
              onClick={() =>
                setVariants([
                  ...variants,
                  {
                    id: crypto.randomUUID(),
                    sku: '',
                    color: 'Đen',
                    size: 'M',
                    price,
                    stockQuantity: 0,
                  },
                ])
              }
            >
              + Thêm biến thể
            </button>
          </div>
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-2 mb-2"
            >
              <input
                aria-label="SKU"
                placeholder="SKU"
                required
                className="field"
                value={variant.sku}
                onChange={(event) =>
                  setVariants(
                    variants.map((item) =>
                      item.id === variant.id ? { ...item, sku: event.target.value } : item,
                    ),
                  )
                }
              />
              <input
                aria-label="Màu"
                placeholder="Màu"
                required
                className="field"
                value={variant.color}
                onChange={(event) =>
                  setVariants(
                    variants.map((item) =>
                      item.id === variant.id ? { ...item, color: event.target.value } : item,
                    ),
                  )
                }
              />
              <input
                aria-label="Size"
                placeholder="Size"
                required
                className="field"
                value={variant.size}
                onChange={(event) =>
                  setVariants(
                    variants.map((item) =>
                      item.id === variant.id ? { ...item, size: event.target.value } : item,
                    ),
                  )
                }
              />
              <input
                aria-label="Tồn kho"
                min={0}
                type="number"
                className="field"
                value={variant.stockQuantity}
                onChange={(event) =>
                  setVariants(
                    variants.map((item) =>
                      item.id === variant.id
                        ? { ...item, stockQuantity: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                disabled={variants.length === 1}
                onClick={() => setVariants(variants.filter((item) => item.id !== variant.id))}
                className="text-red-600"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="flex gap-3">
          <button className="btn-primary">Lưu sản phẩm</button>
          <Link to="/admin/products" className="btn-outline">
            Hủy
          </Link>
        </div>
      </form>
    </>
  );
}
export function AdminInventory() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () => Promise.resolve(getMockProducts()),
  });
  const entries = products
    .flatMap((product) => product.variants.map((variant) => ({ product, variant })))
    .filter(({ product, variant }) =>
      `${product.name} ${variant.sku}`.toLowerCase().includes(search.toLowerCase()),
    );
  const adjust = ({ product, variant }: (typeof entries)[number]) => {
    const input = window.prompt(`Số lượng mới cho ${variant.sku}`, String(variant.stockQuantity));
    if (input === null) return;
    const value = Number(input);
    if (!Number.isInteger(value) || value < 0) return window.alert('Nhập số nguyên không âm.');
    const updated = getMockProducts().map((item) =>
      item.id === product.id
        ? {
            ...item,
            variants: item.variants.map((entry) =>
              entry.id === variant.id ? { ...entry, stockQuantity: value } : entry,
            ),
          }
        : item,
    );
    saveMockProducts(updated);
    void client.invalidateQueries();
  };
  if (!mockMode)
    return (
      <>
        <PageHeading title="Quản lý tồn kho" eyebrow="STOCK CONTROL" />
        <EmptyState
          title="Chưa tích hợp API tồn kho"
          description="Cần endpoint đọc và điều chỉnh SKU từ Backend."
        />
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="STOCK CONTROL"
        title="Quản lý tồn kho"
        description="Điều chỉnh số lượng từng SKU trong chế độ demo."
      />
      <div className="panel">
        <input
          aria-label="Tìm SKU"
          placeholder="Tìm sản phẩm hoặc SKU"
          className="field max-w-sm mb-5"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="overflow-x-auto max-h-[650px]">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Sản phẩm</th>
                <th>Màu / Size</th>
                <th>Tồn kho</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ product, variant }) => (
                <tr key={variant.id}>
                  <td>{variant.sku}</td>
                  <td>{product.name}</td>
                  <td>
                    {variant.color} / {variant.size}
                  </td>
                  <td>
                    <Badge tone={variant.stockQuantity <= 2 ? 'danger' : 'success'}>
                      {variant.stockQuantity}
                    </Badge>
                  </td>
                  <td>
                    <button className="text-brand" onClick={() => adjust({ product, variant })}>
                      Điều chỉnh
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
export function AdminOrders() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data: orders = [], error } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => orderService.list(),
  });
  const filtered = orders.filter(
    (item) =>
      item.orderCode.toLowerCase().includes(search.toLowerCase()) &&
      (!status || item.status === status),
  );
  return (
    <>
      <PageHeading eyebrow="ORDER MANAGEMENT" title="Quản lý đơn hàng" />
      <div className="panel">
        <div className="flex flex-wrap gap-3 mb-5">
          <input
            aria-label="Tìm mã đơn"
            className="field max-w-xs"
            placeholder="Tìm mã đơn hàng"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="field w-48"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
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
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        {error ? (
          <ErrorState error={error} />
        ) : filtered.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th>Tổng tiền</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.orderCode}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <Badge
                        tone={
                          item.status === 'CANCELLED'
                            ? 'danger'
                            : item.status === 'DELIVERED'
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {formatOrderStatus(item.status)}
                      </Badge>
                    </td>
                    <td>{formatCurrency(item.totalAmount)}</td>
                    <td>
                      <Link className="text-brand" to={`/admin/orders/${item.id}`}>
                        Chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}
export function AdminOrderDetail() {
  const { orderId } = useParams();
  const client = useQueryClient();
  const { data: order, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.byId(orderId!),
    enabled: !!orderId,
  });
  const mutation = useMutation({
    mutationFn: (status: OrderStatus) => orderService.updateStatus(orderId!, status),
    onSuccess: () => void client.invalidateQueries(),
  });
  const transitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPING'],
    SHIPPING: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
  };
  if (error) return <ErrorState error={error} />;
  if (!order) return <p>Đang tải...</p>;
  return (
    <>
      <PageHeading
        title={`Đơn hàng ${order.orderCode}`}
        eyebrow="ORDER DETAIL"
        action={
          <Link to="/admin/orders" className="btn-outline">
            ← Danh sách
          </Link>
        }
      />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="panel">
          <h2 className="font-bold mb-4">Sản phẩm</h2>
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-4 py-3 border-b">
              <img src={item.imageUrl} alt="" className="w-16 h-20 object-cover" />
              <div className="flex-1">
                <strong>{item.productName}</strong>
                <p className="text-sm text-slate-500">
                  {item.sku} · {item.color}/{item.size} × {item.quantity}
                </p>
              </div>
              <span>{formatCurrency(item.lineTotal)}</span>
            </div>
          ))}
          <div className="text-right font-bold mt-5">
            Tổng: <span className="text-brand">{formatCurrency(order.totalAmount)}</span>
          </div>
          <h3 className="font-bold mt-7 mb-2">Địa chỉ nhận hàng</h3>
          <p className="text-sm">
            {order.shippingAddress.recipientName} · {order.shippingAddress.phone}
            <br />
            {order.shippingAddress.detail}, {order.shippingAddress.ward},{' '}
            {order.shippingAddress.district}, {order.shippingAddress.province}
          </p>
        </div>
        <aside className="panel h-fit">
          <h2 className="font-bold mb-3">Trạng thái</h2>
          <Badge tone="warning">{formatOrderStatus(order.status)}</Badge>
          <div className="flex flex-wrap gap-2 mt-5">
            {transitions[order.status].map((status) => (
              <button
                key={status}
                disabled={mutation.isPending}
                onClick={() => {
                  if (window.confirm(`Chuyển đơn sang “${formatOrderStatus(status)}”?`))
                    mutation.mutate(status);
                }}
                className={status === 'CANCELLED' ? 'btn-outline' : 'btn-primary'}
              >
                {formatOrderStatus(status)}
              </button>
            ))}
          </div>
          {mutation.error && <p className="field-error mt-3">{mutation.error.message}</p>}
          <h3 className="font-bold mt-7 mb-3">Lịch sử</h3>
          {order.history.map((item) => (
            <p
              key={`${item.status}-${item.at}`}
              className="text-xs border-l-2 border-brand pl-3 py-2"
            >
              {formatOrderStatus(item.status)}
              <br />
              {formatDate(item.at)}
            </p>
          ))}
        </aside>
      </div>
    </>
  );
}
export function AdminKnowledge() {
  const client = useQueryClient();
  const { data: docs = [] } = useQuery({
    queryKey: ['knowledge'],
    queryFn: () => knowledgeService.list(),
  });
  const [editing, setEditing] = useState<KnowledgeDocument | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.length < 3 || content.length < 10) {
      setError('Tiêu đề và nội dung quá ngắn.');
      return;
    }
    try {
      await knowledgeService.save({
        id: editing?.id ?? crypto.randomUUID(),
        title,
        content,
        status: 'INDEXED',
        updatedAt: new Date().toISOString(),
      });
      await client.invalidateQueries({ queryKey: ['knowledge'] });
      setOpen(false);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu.');
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="AI / RAG"
        title="Kho tri thức"
        description="Tài liệu mock được chatbot dùng để trả lời câu hỏi cơ bản."
        action={
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null);
              setTitle('');
              setContent('');
              setOpen(true);
            }}
          >
            + Thêm tài liệu
          </button>
        }
      />
      <div className="grid md:grid-cols-2 gap-4">
        {docs.map((doc) => (
          <article key={doc.id} className="panel">
            <div className="flex justify-between gap-3">
              <h2 className="font-bold">{doc.title}</h2>
              <Badge tone="success">{doc.status}</Badge>
            </div>
            <p className="text-sm text-slate-600 my-3 line-clamp-3">{doc.content}</p>
            <p className="text-xs text-slate-400 mb-4">Cập nhật {formatDate(doc.updatedAt)}</p>
            <div className="flex gap-4 text-sm">
              <button
                className="text-brand"
                onClick={() => {
                  setEditing(doc);
                  setTitle(doc.title);
                  setContent(doc.content);
                  setOpen(true);
                }}
              >
                Chỉnh sửa
              </button>
              <button
                className="text-red-600"
                onClick={async () => {
                  if (window.confirm('Xóa tài liệu này?')) {
                    await knowledgeService.remove(doc.id);
                    await client.invalidateQueries({ queryKey: ['knowledge'] });
                  }
                }}
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(event) => void save(event)}
            className="bg-white p-6 rounded w-full max-w-xl"
          >
            <h2 className="font-bold text-xl mb-5">{editing ? 'Sửa tài liệu' : 'Thêm tài liệu'}</h2>
            <label className="form-label">
              Tiêu đề
              <input
                className="field"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="form-label mt-4">
              Nội dung
              <textarea
                className="field min-h-40"
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
            {error && <p className="field-error">{error}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button className="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
export function AdminReports() {
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => orderService.list(),
  });
  const statuses: OrderStatus[] = [
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPING',
    'DELIVERED',
    'CANCELLED',
  ];
  return (
    <>
      <PageHeading
        title="Báo cáo thống kê"
        eyebrow="REPORTS"
        description="Số liệu từ đơn hàng demo; chưa kết nối hệ thống phân tích Backend."
      />
      <div className="grid md:grid-cols-2 gap-5">
        <div className="panel">
          <h2 className="font-bold mb-4">Đơn theo trạng thái</h2>
          {statuses.map((status) => (
            <div key={status} className="flex justify-between border-b py-3 text-sm">
              <span>{formatOrderStatus(status)}</span>
              <strong>{orders.filter((item) => item.status === status).length}</strong>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2 className="font-bold mb-4">Tổng quan</h2>
          <p className="text-sm mb-3">
            Tổng số đơn: <strong>{orders.length}</strong>
          </p>
          <p className="text-sm mb-3">
            Đơn hoàn tất:{' '}
            <strong>{orders.filter((item) => item.status === 'DELIVERED').length}</strong>
          </p>
          <p className="text-sm">
            Doanh thu đơn đã giao:{' '}
            <strong className="text-brand">
              {formatCurrency(
                orders
                  .filter((item) => item.status === 'DELIVERED')
                  .reduce((sum, item) => sum + item.totalAmount, 0),
              )}
            </strong>
          </p>
        </div>
      </div>
    </>
  );
}
export function AdminUsers() {
  return (
    <>
      <PageHeading
        title="Người dùng"
        eyebrow="ADMIN"
        description="Danh sách tài khoản mẫu. Quản trị tài khoản cần API Backend."
      />
      {!mockMode ? (
        <EmptyState title="Chưa tích hợp API người dùng" />
      ) : (
        <div className="panel">
          <table className="data-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {demoUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export function AdminConversations() {
  const messages = mockMode ? mockConversations.list() : [];
  const ids = [...new Set(messages.map((item) => item.conversationId))];
  const [selected, setSelected] = useState(ids[0] ?? '');
  return (
    <>
      <PageHeading
        title="Hội thoại AI"
        eyebrow="AI / RAG"
        description={
          mockMode
            ? 'Lịch sử hội thoại phát sinh trong trình duyệt này.'
            : 'Chưa tích hợp API hội thoại và quyền truy cập Backend.'
        }
      />
      {!mockMode ? (
        <EmptyState title="Chưa tích hợp Backend" />
      ) : !ids.length ? (
        <EmptyState
          title="Chưa có hội thoại"
          description="Hãy thử đặt câu hỏi trong chatbot để tạo dữ liệu demo."
        />
      ) : (
        <div className="grid md:grid-cols-[240px_1fr] gap-5">
          <div className="panel space-y-2">
            {ids.map((id) => (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`block w-full text-left border rounded p-3 text-sm ${selected === id ? 'border-brand bg-orange-50' : ''}`}
              >
                {messages.find((item) => item.conversationId === id && item.role === 'USER')
                  ?.content ?? id}
              </button>
            ))}
          </div>
          <div className="panel space-y-3">
            {messages
              .filter((item) => item.conversationId === selected)
              .map((item) => (
                <div key={item.id} className="border-b pb-3 text-sm">
                  <strong>{item.role === 'USER' ? 'Khách hỏi' : 'Trợ lý'}</strong>
                  <p className="mt-1">{item.content}</p>
                  <small className="text-slate-500">{formatDate(item.createdAt)}</small>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}

export function AdminCategories() {
  const client = useQueryClient();
  const { data: categories = [], error } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState('');
  const start = (item?: Category) => {
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setSlug(item?.slug ?? '');
    setDescription(item?.description ?? '');
    setIsActive(item?.isActive ?? true);
    setMessage('');
    setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (categories.some((item) => item.slug === slug && item.id !== editing?.id)) {
      setMessage('Slug đã tồn tại.');
      return;
    }
    try {
      await categoryService.save({
        id: editing?.id ?? crypto.randomUUID(),
        name,
        slug,
        description,
        isActive,
      });
      await client.invalidateQueries({ queryKey: ['categories'] });
      setOpen(false);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Không thể lưu danh mục.');
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Quản lý danh mục"
        description="Danh mục được dùng chung với bộ lọc và điều hướng cửa hàng."
        action={
          mockMode && (
            <button className="btn-primary" onClick={() => start()}>
              + Thêm danh mục
            </button>
          )
        }
      />
      {error ? (
        <ErrorState error={error} />
      ) : !mockMode ? (
        <EmptyState title="Chưa tích hợp API quản lý danh mục" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Slug</th>
                <th>Trạng thái</th>
                <th>Sản phẩm</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium">{item.name}</td>
                  <td>{item.slug}</td>
                  <td>
                    <Badge tone={item.isActive ? 'success' : 'neutral'}>
                      {item.isActive ? 'Hiển thị' : 'Đã ẩn'}
                    </Badge>
                  </td>
                  <td>
                    {getMockProducts().filter((product) => product.categoryId === item.id).length}
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button className="text-brand" onClick={() => start(item)}>
                        Sửa
                      </button>
                      <button
                        className="text-red-600"
                        onClick={async () => {
                          if (!window.confirm(`Xóa danh mục ${item.name}?`)) return;
                          try {
                            await categoryService.remove(item.id);
                            await client.invalidateQueries({ queryKey: ['categories'] });
                          } catch (caught) {
                            window.alert(
                              caught instanceof Error ? caught.message : 'Không thể xóa.',
                            );
                          }
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={(event) => void save(event)}
            className="bg-white p-6 rounded w-full max-w-lg space-y-4"
          >
            <h2 className="text-xl font-bold">{editing ? 'Sửa danh mục' : 'Thêm danh mục'}</h2>
            <label className="form-label">
              Tên danh mục
              <input
                required
                minLength={2}
                className="field"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!editing)
                    setSlug(
                      event.target.value
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/đ/g, 'd')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    );
                }}
              />
            </label>
            <label className="form-label">
              Slug
              <input
                required
                pattern="[a-z0-9-]+"
                className="field"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </label>
            <label className="form-label">
              Mô tả
              <textarea
                className="field"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Hiển thị trên cửa hàng
            </label>
            {message && <p className="field-error">{message}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button className="btn-primary">Lưu</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
