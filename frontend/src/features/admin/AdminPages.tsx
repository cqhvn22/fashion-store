import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Printer, Layers, Grid } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, EmptyState, ErrorState, PageHeading } from '../../components/common';
import { OrderTimeline } from '../../components/OrderTimeline';
import { OrderInvoiceModal } from '../../components/OrderInvoice';
import { demoUsers } from '../../mocks/catalog';
import {
  categoryService,
  getMockProducts,
  productService,
  saveMockProducts,
} from '../../services/catalog';
import { mockConversations } from '../../services/chat';
import { orderService } from '../../services/orders';
import { httpClient, mockMode, useDbCatalog } from '../../services/httpClient';
import { uploadImage } from '../../services/media';
import { bannerService } from '../../services/banners';
import type { Category, HomeBanner, Order, OrderStatus, Product, ProductImage } from '../../types/models';
import { formatCurrency, formatDate, formatOrderStatus } from '../../utils/format';
import { getCardImageUrl, getThumbnailUrl, showProductPlaceholder } from '../../utils/images';
import { getPaginationItems } from '../../utils/pagination';

function AdminModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); };
  }, [onClose]);
  return <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-3 md:p-8" role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-2xl shadow-2xl max-w-5xl mx-auto p-5 md:p-8 relative">
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute right-4 top-4 text-2xl text-slate-500 hover:text-ink">×</button>
      {children}
    </div>
  </div>;
}

export function AdminDashboard() {
  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => orderService.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () =>
      productService.listAdmin(),
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
        description="Theo dõi hoạt động của cửa hàng trong một nơi."
      />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          ['Sản phẩm', products.length],
          ['Đơn hàng', orders.length],
          ['Chờ xử lý', orders.filter((item) => item.status === 'PENDING').length],
          ['Doanh thu', formatCurrency(revenue)],
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const client = useQueryClient();
  const { data: products = [], refetch } = useQuery({
    queryKey: ['admin-products'],
    queryFn: () =>
      productService.listAdmin(),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((item) => {
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
      const matchStatus = !status || item.status === status;
      return matchSearch && matchStatus;
    });
  }, [products, search, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const shown = useMemo(() => {
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  }, [filtered, page, pageSize]);

  const remove = async (id: string) => {
    if (!window.confirm('Xóa sản phẩm này?')) return;
    // Cập nhật lạc quan (optimistic): gỡ sản phẩm khỏi cache ngay tức thì để UI không giật hay reload
    client.setQueryData<Product[]>(['admin-products'], (old) => old?.filter((p) => p.id !== id) ?? []);
    try {
      await productService.remove(id);
      void client.invalidateQueries({ queryKey: ['admin-products'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['products'] });
    } catch {
      alert('Không thể xóa sản phẩm.');
      void refetch();
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Quản lý sản phẩm"
        action={
          <button className="btn-primary" onClick={() => setEditingId('new')}>
            + Thêm sản phẩm
          </button>
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
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
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
                        src={getThumbnailUrl(item.images[0]?.url)}
                        alt=""
                        onError={(e) => {
                          const target = e.currentTarget;
                          const raw = item.images[0]?.url;
                          if (raw && target.src !== raw) {
                            target.src = raw;
                          } else {
                            showProductPlaceholder(e);
                          }
                        }}
                        className="w-12 h-14 object-cover rounded"
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td>{categories.find((category) => category.id === item.categoryId)?.name}</td>
                  <td>
                    <div>
                      <div className="font-semibold text-ink">{formatCurrency(item.minPrice)}</div>
                      {item.originalPrice && item.originalPrice > item.minPrice && (
                        <div className="text-[11px] text-slate-400 line-through">
                          {formatCurrency(item.originalPrice)}
                        </div>
                      )}
                      {item.promotion && (
                        <Link
                          to="/admin/promotions"
                          className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-brand bg-red-50 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
                          title="Bấm để xem quản lý khuyến mãi"
                        >
                          🏷️ {item.promotion.name}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge tone={item.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {item.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex gap-3">
                      <button className="text-brand font-medium hover:underline" onClick={() => setEditingId(item.id)}>
                        Sửa
                      </button>
                      <button className="text-red-600 font-medium hover:underline" onClick={() => void remove(item.id)}>
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
        {filtered.length > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6 pt-4 border-t border-slate-200 text-sm">
            <div className="flex flex-wrap items-center gap-3 text-slate-600">
              <span>
                Hiển thị <strong>{(page - 1) * pageSize + 1}</strong> - <strong>{Math.min(page * pageSize, filtered.length)}</strong> trên tổng số <strong>{filtered.length}</strong> sản phẩm
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-xs text-slate-500">Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="field py-1 px-2 text-xs w-auto bg-white"
                  aria-label="Số sản phẩm trên mỗi trang"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                  <option value={100}>100 / trang</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="pager px-2.5 w-auto text-xs"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="Về trang đầu"
              >
                « Đầu
              </button>
              <button
                type="button"
                className="pager px-2.5 w-auto text-xs"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                title="Trang trước"
              >
                ← Trước
              </button>

              <div className="flex items-center gap-1">
                {getPaginationItems(page, totalPages).map((item, idx) =>
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      className={`pager ${page === item ? 'active' : ''}`}
                      onClick={() => setPage(item)}
                      aria-current={page === item ? 'page' : undefined}
                    >
                      {item}
                    </button>
                  ) : (
                    <span
                      key={`dots-${idx}`}
                      className="w-7 h-9 flex items-center justify-center text-sm font-bold text-slate-400 select-none tracking-widest"
                      aria-hidden="true"
                    >
                      ...
                    </span>
                  )
                )}
              </div>

              <button
                type="button"
                className="pager px-2.5 w-auto text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                title="Trang sau"
              >
                Sau →
              </button>
              <button
                type="button"
                className="pager px-2.5 w-auto text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
                title="Đến trang cuối"
              >
                Cuối »
              </button>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-300">
                  <span className="text-xs text-slate-500">Đến:</span>
                  <select
                    value={page}
                    onChange={(e) => setPage(Number(e.target.value))}
                    className="field py-1 px-2 text-xs w-auto bg-white font-medium"
                    aria-label="Chọn số trang trực tiếp"
                  >
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>
                        Trang {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {editingId && <AdminModal title={editingId === 'new' ? 'Thêm sản phẩm' : 'Sửa sản phẩm'} onClose={() => setEditingId(null)}>
        <AdminProductForm productId={editingId === 'new' ? undefined : editingId} onClose={() => setEditingId(null)} />
      </AdminModal>}
    </>
  );
}
export function AdminProductForm({ productId, onClose }: { productId?: string; onClose?: () => void } = {}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const { id: routeId } = useParams();
  const id = productId ?? routeId;
  const { data: loaded, isLoading: loadingProduct, error: loadError } = useQuery({
    queryKey: ['admin-product', id], queryFn: () => productService.adminById(id!), enabled: !!id,
  });
  const navigate = useNavigate();
  const client = useQueryClient();
  const existing = loaded;
  const [name, setName] = useState(existing?.name ?? '');
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'cat-01');
  const [price, setPrice] = useState(existing?.minPrice ?? 0);
  const [images, setImages] = useState<ProductImage[]>(existing?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Product['status']>(existing?.status ?? 'ACTIVE');
  const [variants, setVariants] = useState(
    existing?.variants ?? [
      { id: crypto.randomUUID(), sku: '', color: 'Đen', size: 'M', price: 0, stockQuantity: 0, images: [] },
    ],
  );
  const [error, setError] = useState('');
  useEffect(() => {
    if (!loaded) return;
    setName(loaded.name); setSlug(loaded.slug); setDescription(loaded.description);
    setCategoryId(loaded.categoryId); setPrice(loaded.minPrice);
    setImages(loaded.images);
    setStatus(loaded.status); setVariants(loaded.variants.map((item) => ({
      ...item,
      images: item.images?.length ? item.images : item.imageUrl
        ? [{ id: crypto.randomUUID(), url: item.imageUrl, alt: `${loaded.name} ${item.color}`, isPrimary: true }]
        : [],
    })));
  }, [loaded]);
  useEffect(() => {
    if (categories.length && !categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId]);
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    if (images.length + files.length > 12) { setError('Mỗi sản phẩm có tối đa 12 ảnh.'); return; }
    setUploading(true); setError('');
    try {
      const urls = await Promise.all(Array.from(files).map(uploadImage));
      setImages((current) => [...current, ...urls.map((url, index) => ({
        id: crypto.randomUUID(), url, alt: name.trim(), isPrimary: !current.length && index === 0,
      }))]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không tải được ảnh.'); }
    finally { setUploading(false); }
  };
  const updateVariant = (id: string, change: Partial<Product['variants'][number]>) => {
    setVariants((current) => current.map((item) => item.id === id ? { ...item, ...change } : item));
  };
  const addVariantImages = async (id: string, files: FileList | null) => {
    if (!files?.length) return;
    const current = variants.find((item) => item.id === id);
    if (!current || (current.images?.length ?? 0) + files.length > 8) {
      setError('Mỗi biến thể có tối đa 8 ảnh.'); return;
    }
    setUploading(true); setError('');
    try {
      const urls = await Promise.all(Array.from(files).map(uploadImage));
      setVariants((items) => items.map((item) => {
        if (item.id !== id) return item;
        const old = item.images ?? [];
        return { ...item, images: [...old, ...urls.map((url, index) => ({
          id: crypto.randomUUID(), url, alt: `${name} ${item.color}`,
          isPrimary: old.length === 0 && index === 0,
        }))] };
      }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không tải được ảnh.'); }
    finally { setUploading(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      name.trim().length < 2 || name.trim().length > 250 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 220 ||
      !categories.some((item) => item.id === categoryId) ||
      !description.trim() || description.length > 10000 ||
      !Number.isSafeInteger(price) || price < 1000 ||
      images.length < 1 || images.length > 12 || images.filter((image) => image.isPrimary).length !== 1 ||
      variants.length < 1 || variants.length > 100 ||
      variants.some((item) => !item.sku.trim() || !item.color.trim() || !item.size.trim()
        || !Number.isSafeInteger(item.stockQuantity) || item.stockQuantity < 0
        || !Number.isSafeInteger(item.price) || item.price < 1000
        || (item.images?.length ?? 0) > 8
        || ((item.images?.length ?? 0) > 0 && item.images?.filter((image) => image.isPrimary).length !== 1)) ||
      new Set(variants.map((item) => item.sku.trim())).size !== variants.length
    ) {
      setError('Kiểm tra tên, đường dẫn, giá, danh mục, ảnh chính và các lựa chọn sản phẩm.');
      return;
    }
    const now = new Date().toISOString();
    const product: Product = {
      id: existing?.id ?? (useDbCatalog ? '' : crypto.randomUUID()),
      slug,
      name,
      description,
      categoryId,
      images: [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((image) => ({ ...image, alt: image.alt || name.trim() })),
      variants: variants.map((item) => ({ ...item, sku: item.sku.trim(),
        imageUrl: item.images?.find((image) => image.isPrimary)?.url })),
      minPrice: Math.min(...variants.map((item) => item.price)),
      maxPrice: Math.max(...variants.map((item) => item.price)),
      status,
      brand: existing?.brand ?? 'FashionHub',
      ratingAverage: existing?.ratingAverage ?? 0,
      reviewCount: existing?.reviewCount ?? 0,
      soldCount: existing?.soldCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      const saved = await productService.save(product);
      // Optimistic update: cập nhật hoặc thêm sản phẩm vào cache ngay lập tức để không bị reload / lag
      client.setQueryData<Product[]>(['admin-products'], (old) => {
        if (!old) return [saved];
        const exists = old.some((p) => p.id === saved.id);
        return exists ? old.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...old];
      });
      void client.invalidateQueries({ queryKey: ['admin-products'], refetchType: 'none' });
      void client.invalidateQueries({ queryKey: ['products'] });
      void client.invalidateQueries({ queryKey: ['admin-product', saved.id] });
      if (onClose) onClose(); else navigate('/admin/products');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu sản phẩm.');
    }
  };
  return (
    <>
      <PageHeading title={id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} eyebrow="CATALOG" />
      {loadingProduct && <p>Đang tải sản phẩm...</p>}
      {loadError && <ErrorState error={new Error('Không tải được sản phẩm.')} />}
      {!loadingProduct && !loadError &&
      <form onSubmit={(event) => void submit(event)} className="panel space-y-5 max-w-4xl">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="form-label">
            Tên sản phẩm
            <input
              required minLength={2} maxLength={250}
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
              required maxLength={220} pattern="[a-z0-9]+(-[a-z0-9]+)*"
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
            Giá niêm yết mặc định (VND)
            <input
              required
              min={1000} step={1}
              type="number"
              className="field"
              value={price}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPrice(next);
                setVariants((current) => current.map((item) => item.price === 0 ? { ...item, price: next } : item));
              }}
            />
          </label>
        </div>
        <label className="form-label">
          Mô tả
          <textarea
            required maxLength={10000}
            className="field min-h-28"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="space-y-3">
          <label className="form-label">Ảnh sản phẩm (JPG, PNG, WebP; tối đa 5 MB/ảnh)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="field" disabled={uploading} onChange={(event) => { void addImages(event.target.files); event.target.value = ''; }} />
          </label>
          {uploading && <p className="text-sm text-slate-500">Đang tải ảnh...</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((image) => <div key={image.id} className="border rounded-lg p-2 space-y-2">
              <img src={image.url} alt={image.alt} className="w-full aspect-square object-cover rounded" />
              <label className="flex items-center gap-2 text-sm"><input type="radio" name="primaryImage" checked={image.isPrimary} onChange={() => setImages(images.map((item) => ({ ...item, isPrimary: item.id === image.id })))} />Ảnh chính</label>
              <button type="button" className="text-red-600 text-sm" onClick={() => setImages((current) => {
                const next = current.filter((item) => item.id !== image.id);
                if (image.isPrimary && next.length) next[0] = { ...next[0], isPrimary: true };
                return next;
              })}>Xóa ảnh</button>
            </div>)}
          </div>
        </div>
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
                    images: [],
                  },
                ])
              }
            >
              + Thêm biến thể
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[1.2fr_1fr_0.7fr_1fr_0.8fr_1.4fr_auto] gap-2 mb-2 font-bold text-xs uppercase text-slate-500">
                <span>SKU</span>
                <span>Màu</span>
                <span>Size</span>
                <span>Giá niêm yết</span>
                <span>Tồn kho</span>
                <span>Ảnh biến thể</span>
                <span></span>
              </div>
              {variants.map((variant) => (
                <div
                  key={variant.id}
                  className="grid grid-cols-[1.2fr_1fr_0.7fr_1fr_0.8fr_1.4fr_auto] gap-2 mb-4 items-start border-b pb-4"
                >
                  <input
                    aria-label="SKU"
                    placeholder="SKU"
                    required
                    maxLength={80}
                    className="field text-xs"
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
                    maxLength={80}
                    className="field text-xs"
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
                    maxLength={40}
                    className="field text-xs"
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
                    aria-label={`Giá niêm yết ${variant.sku || variant.color}`}
                    min={1000} step={1} type="number" required
                    className="field text-xs" value={variant.price}
                    onChange={(event) => updateVariant(variant.id, { price: Number(event.target.value) })}
                  />
                  <input
                    aria-label="Tồn kho"
                    min={0}
                    step={1}
                    type="number"
                    className="field text-xs"
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
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      {(variant.images ?? []).map((image) => <div key={image.id} className="w-12">
                        <img src={image.url} alt={image.alt} className="w-12 h-12 object-cover border" />
                        <label className="text-[10px] flex gap-0.5 items-center">
                          <input type="radio" name={`primary-${variant.id}`} checked={image.isPrimary}
                            onChange={() => updateVariant(variant.id, {
                              images: variant.images?.map((item) => ({ ...item, isPrimary: item.id === image.id })),
                            })} />Chính
                        </label>
                        <button type="button" className="text-[10px] text-red-600" onClick={() => {
                          const remaining = (variant.images ?? []).filter((item) => item.id !== image.id);
                          if (image.isPrimary && remaining.length) remaining[0] = { ...remaining[0], isPrimary: true };
                          updateVariant(variant.id, { images: remaining });
                        }}>Xóa</button>
                      </div>)}
                    </div>
                    <select aria-label={`Dùng ảnh sản phẩm cho ${variant.sku || variant.color}`}
                      className="field text-xs py-1" value="" onChange={(event) => {
                        const image = images.find((item) => item.url === event.target.value);
                        if (!image || variant.images?.some((item) => item.url === image.url)) return;
                        if ((variant.images?.length ?? 0) >= 8) { setError('Mỗi biến thể có tối đa 8 ảnh.'); return; }
                        updateVariant(variant.id, { images: [...(variant.images ?? []), {
                          ...image, id: crypto.randomUUID(), isPrimary: !variant.images?.length,
                        }] });
                      }}>
                      <option value="">+ Chọn ảnh chung</option>
                      {images.map((image, index) => <option key={image.id} value={image.url}>Ảnh {index + 1}</option>)}
                    </select>
                    <label className="btn-outline inline-block py-1 px-2 text-[11px] cursor-pointer">
                      + Tải ảnh riêng
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                        disabled={uploading} onChange={(event) => {
                          void addVariantImages(variant.id, event.target.files);
                          event.target.value = '';
                        }} />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={variants.length === 1}
                    onClick={() => setVariants(variants.filter((item) => item.id !== variant.id))}
                    className="text-red-600 text-xs hover:underline disabled:opacity-30"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="flex gap-3">
          <button className="btn-primary" disabled={uploading}>Lưu sản phẩm</button>
          {onClose ? <button type="button" onClick={onClose} className="btn-outline">Hủy</button>
            : <Link to="/admin/products" className="btn-outline">Hủy</Link>}
        </div>
      </form>}
    </>
  );
}
const emptyBanner = (): HomeBanner => ({
  id: '', title: '', subtitle: '', imageUrl: '', linkUrl: '/products',
  buttonLabel: 'Khám phá', sortOrder: 0, isActive: true,
});
export function AdminBanners() {
  const client = useQueryClient();
  const { data: banners = [], isLoading, error: loadError } = useQuery({
    queryKey: ['admin-banners'], queryFn: bannerService.listAdmin,
  });
  const [editing, setEditing] = useState<HomeBanner | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (editing.title.trim().length < 2 || editing.title.length > 150
      || !editing.imageUrl || editing.subtitle.length > 400
      || !editing.linkUrl.startsWith('/') || editing.linkUrl.startsWith('//')
      || !editing.buttonLabel.trim() || editing.buttonLabel.length > 60
      || !Number.isSafeInteger(editing.sortOrder) || editing.sortOrder < 0) {
      setError('Kiểm tra tiêu đề, ảnh, liên kết, nút và thứ tự hiển thị.'); return;
    }
    setSaving(true); setError('');
    try {
      await bannerService.save(editing);
      await client.invalidateQueries({ queryKey: ['admin-banners'] });
      await client.invalidateQueries({ queryKey: ['banners'] });
      setEditing(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không lưu được banner.'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Xóa banner này?')) return;
    try {
      await bannerService.remove(id);
      await client.invalidateQueries({ queryKey: ['admin-banners'] });
      await client.invalidateQueries({ queryKey: ['banners'] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Không xóa được banner.'); }
  };
  return <>
    <PageHeading eyebrow="TRANG CHỦ" title="Quản lý banner" action={<button className="btn-primary" onClick={() => { setEditing(emptyBanner()); setError(''); }}>+ Thêm banner</button>} />
    {loadError && <ErrorState error={new Error('Không tải được banner.')} />}
    {isLoading && <p>Đang tải banner...</p>}
    {error && <p className="field-error mb-4" role="alert">{error}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      {banners.map((banner) => <div key={banner.id} className="panel space-y-3">
        <img src={banner.imageUrl} alt="" className="w-full aspect-[16/7] rounded object-cover" />
        <div className="flex justify-between gap-2"><div><strong>{banner.title}</strong><p className="text-sm text-slate-500">Thứ tự {banner.sortOrder} · {banner.isActive ? 'Đang hiển thị' : 'Đang ẩn'}</p></div>
          <div className="flex gap-3"><button className="text-brand" onClick={() => { setEditing(banner); setError(''); }}>Sửa</button><button className="text-red-600" onClick={() => void remove(banner.id)}>Xóa</button></div>
        </div>
      </div>)}
    </div>
    {editing && <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto p-4 flex items-start justify-center">
      <form className="panel w-full max-w-xl my-8 space-y-4" onSubmit={(event) => void save(event)}>
        <h2 className="text-xl font-bold">{editing.id ? 'Sửa banner' : 'Thêm banner'}</h2>
        <label className="form-label">Tiêu đề<input required minLength={2} maxLength={150} className="field" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
        <label className="form-label">Mô tả<input maxLength={400} className="field" value={editing.subtitle} onChange={(event) => setEditing({ ...editing, subtitle: event.target.value })} /></label>
        <label className="form-label">Ảnh banner (JPG, PNG, WebP; tối đa 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" className="field" disabled={uploading} onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          setUploading(true); setError('');
          try { const url = await uploadImage(file); setEditing((current) => current ? { ...current, imageUrl: url } : current); }
          catch (caught) { setError(caught instanceof Error ? caught.message : 'Không tải được ảnh.'); }
          finally { setUploading(false); }
        }} /></label>
        {editing.imageUrl && <img src={editing.imageUrl} alt="Xem trước banner" className="w-full aspect-[16/7] object-cover rounded" />}
        <label className="form-label">Liên kết khi bấm banner<input required maxLength={500} pattern="/(?!/).*" className="field" value={editing.linkUrl} onChange={(event) => setEditing({ ...editing, linkUrl: event.target.value })} /></label>
        <label className="form-label">Chữ trên nút<input required maxLength={60} className="field" value={editing.buttonLabel} onChange={(event) => setEditing({ ...editing, buttonLabel: event.target.value })} /></label>
        <label className="form-label">Thứ tự hiển thị<input required type="number" min={0} step={1} className="field" value={editing.sortOrder} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) })} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} />Hiển thị trên trang chủ</label>
        <div className="flex gap-3"><button className="btn-primary" disabled={saving || uploading}>{saving ? 'Đang lưu...' : 'Lưu banner'}</button><button type="button" className="btn-outline" onClick={() => setEditing(null)}>Hủy</button></div>
      </form>
    </div>}
  </>;
}
export function AdminInventory() {
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: entries = [] } = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: async () => {
      if (!useDbCatalog) return getMockProducts().flatMap((product) =>
        product.variants.map((variant) => ({ product: { ...product, imageUrl: product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url }, variant })));
      const { data } = await httpClient.get<{ data: Array<{
        id: string; name: string; sku: string; color: string; size: string;
        stockQuantity: number; reservedQuantity: number; imageUrl: string | null;
      }> }>('/admin/inventory');
      return data.data.map((row) => ({ product: { name: row.name, imageUrl: row.imageUrl }, variant: row }));
    },
  });
  const filteredEntries = entries
    .filter(({ product, variant }) =>
      `${product.name} ${variant.sku}`.toLowerCase().includes(search.toLowerCase()),
    );
  const adjust = async ({ product, variant }: {
    product: { id?: string; name: string };
    variant: { id: string; sku: string; stockQuantity: number };
  }) => {
    const input = window.prompt(`Số lượng mới cho ${variant.sku}`, String(variant.stockQuantity));
    if (input === null) return;
    const value = Number(input);
    if (!Number.isInteger(value) || value < 0) return window.alert('Nhập số nguyên không âm.');
    if (useDbCatalog) {
      try {
        await httpClient.patch(`/admin/inventory/${variant.id}`, { stockQuantity: value });
        await client.invalidateQueries({ queryKey: ['admin-inventory'] });
        await client.invalidateQueries({ queryKey: ['admin-products'] });
      } catch (caught) { window.alert(caught instanceof Error ? caught.message : 'Không cập nhật được tồn kho.'); }
      return;
    }
    const updated = getMockProducts().map((item) =>
      item.id === ('id' in product ? product.id : '')
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
  return (
    <>
      <PageHeading
        eyebrow="STOCK CONTROL"
        title="Quản lý tồn kho"
        description="Theo dõi và điều chỉnh số lượng còn lại của từng sản phẩm."
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
                <th>Ảnh</th>
                <th>SKU</th>
                <th>Sản phẩm</th>
                <th>Màu / Size</th>
                <th>Tồn kho</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(({ product, variant }) => (
                <tr key={variant.id}>
                  <td><img src={product.imageUrl || '/images/product-placeholder.svg'} alt={product.name}
                    onError={showProductPlaceholder} className="w-12 h-14 object-cover rounded border" /></td>
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
                    <button className="text-brand" onClick={() => void adjust({ product, variant })}>
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
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const { data: orders = [], error, refetch, isFetching } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => orderService.list(),
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="btn-outline flex items-center gap-1.5 text-sm py-2 px-3"
            title="Làm mới danh sách đơn hàng"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
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
                  <th>Thao tác</th>
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
                      <div className="flex items-center gap-2">
                        <button
                          className="text-brand font-medium hover:underline text-sm"
                          onClick={() => setSelectedOrderId(item.id)}
                        >
                          Chi tiết
                        </button>
                        <button
                          className="text-slate-600 hover:text-ink flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-200 hover:border-slate-400 bg-white"
                          onClick={() => setInvoiceOrder(item)}
                          title="In hóa đơn & Phiếu đóng gói"
                        >
                          <Printer size={13} />
                          <span>In đơn</span>
                        </button>
                      </div>
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
      {selectedOrderId && <AdminModal title="Chi tiết đơn hàng" onClose={() => setSelectedOrderId(null)}>
        <AdminOrderDetail orderIdOverride={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      </AdminModal>}
      {invoiceOrder && (
        <OrderInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </>
  );
}
export function AdminOrderDetail({ orderIdOverride, onClose }: { orderIdOverride?: string; onClose?: () => void } = {}) {
  const { orderId: routeId } = useParams();
  const orderId = orderIdOverride ?? routeId;
  const [showInvoice, setShowInvoice] = useState(false);
  const client = useQueryClient();
  const { data: order, error, isFetching, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.byId(orderId!),
    enabled: !!orderId,
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="btn-outline flex items-center justify-center gap-1.5 text-xs py-2 px-3 min-w-[96px]"
              title="Đồng bộ lại đơn hàng"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin text-brand' : ''} />
              <span>{isFetching ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowInvoice(true)}
              className="btn-primary bg-ink text-white hover:bg-black flex items-center gap-2 text-sm py-2 px-3.5 shadow-sm"
              title="Xem và in hóa đơn & phiếu đóng gói (PDF)"
            >
              <Printer size={15} />
              <span>In hóa đơn</span>
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} className="btn-outline">
                Đóng
              </button>
            ) : (
              <Link to="/admin/orders" className="btn-outline">
                ← Danh sách
              </Link>
            )}
          </div>
        }
      />
      <div className="grid lg:grid-cols-[1fr_300px] gap-5">
        <div className="panel">
          <h2 className="font-bold mb-4">Sản phẩm</h2>
          {order.items.map((item) => {
            const productUrl = `/products/${(item as any).productSlug || item.productId}`;
            return (
              <div key={item.id} className="flex gap-4 py-3 border-b">
                <Link
                  to={productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 hover:opacity-80 transition-opacity"
                  title={`Xem ${item.productName} trên website`}
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
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-brand hover:underline font-bold text-ink inline-block"
                    title={`Xem ${item.productName} trên website`}
                  >
                    <strong>{item.productName}</strong>
                  </Link>
                  <p className="text-sm text-slate-500">
                    {item.sku} · {item.color}/{item.size} × {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 font-medium">{formatCurrency(item.lineTotal)}</span>
              </div>
            );
          })}
          <div className="mt-5 pt-3 border-t border-slate-100 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Tạm tính:</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Phí vận chuyển:</span>
              <span>{order.shippingFee === 0 ? 'Miễn phí' : formatCurrency(order.shippingFee)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Giảm giá:</span>
                <span>-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold text-base pt-2 border-t">
              <span>Tổng thanh toán:</span>
              <span className="text-brand text-lg">{formatCurrency(order.totalAmount)}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-sm">
            <span className="text-slate-500">Phương thức thanh toán:</span>
            <span className="font-semibold">{order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : order.paymentMethod}</span>
          </div>
          <h3 className="font-bold mt-7 mb-2">Địa chỉ nhận hàng</h3>
          <p className="text-sm">
            {order.shippingAddress.recipientName} · {order.shippingAddress.phone}
            <br />
            {order.shippingAddress.detail}, {order.shippingAddress.ward},{' '}
            {order.shippingAddress.district ? `${order.shippingAddress.district}, ` : ''}{order.shippingAddress.province}
          </p>
          {order.note && (
            <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded text-sm text-amber-900">
              <strong className="block text-xs uppercase tracking-wider text-amber-800 mb-1">Ghi chú của khách:</strong>
              {order.note}
            </div>
          )}
        </div>
        <aside className="panel h-fit">
          <h2 className="font-bold mb-3">Trạng thái</h2>
          <Badge
            tone={
              order.status === 'CANCELLED'
                ? 'danger'
                : order.status === 'DELIVERED'
                  ? 'success'
                  : 'warning'
            }
          >
            {formatOrderStatus(order.status)}
          </Badge>
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
          <h3 className="font-bold mt-7 mb-3">Lịch sử xử lý</h3>
          <OrderTimeline history={order.history} />
        </aside>
      </div>
      {showInvoice && (
        <OrderInvoiceModal
          order={order}
          onClose={() => setShowInvoice(false)}
        />
      )}
    </>
  );
}
export { AdminKnowledgeManager as AdminKnowledge } from './AdminKnowledgeManager';
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
        description="Tổng hợp tình hình đơn hàng và doanh thu."
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
        description="Xem các tài khoản trong cửa hàng."
      />
      {!mockMode ? (
        <EmptyState title="Danh sách tài khoản chưa sẵn sàng" />
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
        eyebrow="TRỢ LÝ MUA SẮM"
        description={
          mockMode
            ? 'Lịch sử hội thoại phát sinh trong trình duyệt này.'
            : 'Hội thoại hiện chưa sẵn sàng.'
        }
      />
      {!mockMode ? (
        <EmptyState title="Hội thoại hiện chưa sẵn sàng" />
      ) : !ids.length ? (
        <EmptyState
          title="Chưa có hội thoại"
          description="Hãy thử đặt câu hỏi cho trợ lý mua sắm để bắt đầu hội thoại."
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
    queryKey: ['admin-categories'],
    queryFn: categoryService.listAdmin,
  });
  const { data: products = [] } = useQuery({
    queryKey: ['admin-products'],
    queryFn: productService.listAdmin,
  });
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [message, setMessage] = useState('');
  const start = (item?: Category) => {
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setSlug(item?.slug ?? '');
    setDescription(item?.description ?? '');
    setParentId(item?.parentId ?? '');
    setIsActive(item?.isActive ?? true);
    setMessage('');
    setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || name.length > 150
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180
      || description.length > 5000 || (parentId && !categories.some((item) => item.id === parentId))) {
      setMessage('Kiểm tra tên, đường dẫn, mô tả và danh mục cha.'); return;
    }
    if (categories.some((item) => item.slug === slug && item.id !== editing?.id)) {
      setMessage('Slug đã tồn tại.');
      return;
    }
    try {
      await categoryService.save({
        id: editing?.id ?? (useDbCatalog ? '' : crypto.randomUUID()),
        name,
        slug,
        description,
        parentId: parentId || null,
        isActive,
      });
      await client.invalidateQueries({ queryKey: ['categories'] });
      await client.invalidateQueries({ queryKey: ['admin-categories'] });
      setOpen(false);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Không thể lưu danh mục.');
    }
  };
  const descendants = (id: string): Set<string> => {
    const found = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of categories) {
        if (item.parentId && found.has(item.parentId) && !found.has(item.id)) {
          found.add(item.id);
          changed = true;
        }
      }
    }
    return found;
  };
  const depth = (item: Category): number => {
    let level = 0;
    let parent = item.parentId;
    const seen = new Set([item.id]);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      level += 1;
      parent = categories.find((candidate) => candidate.id === parent)?.parentId;
    }
    return level;
  };
  const orderedCategories: Category[] = [];
  const visit = (parent: string | null) => {
    categories.filter((item) => (item.parentId ?? null) === parent)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .forEach((item) => { orderedCategories.push(item); visit(item.id); });
  };
  visit(null);

  const categoryProductCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) {
      const targetIds = descendants(cat.id);
      const count = products.filter((p) => targetIds.has(p.categoryId)).length;
      map.set(cat.id, count);
    }
    return map;
  }, [categories, products]);
  return (
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Quản lý danh mục"
        description="Danh mục được dùng chung với bộ lọc và điều hướng cửa hàng."
        action={<button className="btn-primary" onClick={() => start()}>+ Thêm danh mục</button>}
      />

      {/* Navigation Switcher Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200">
        <Link
          to="/admin/home-categories"
          className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-ink transition-colors flex items-center gap-2"
        >
          <Layers size={15} /> Danh mục hiển thị Trang chủ
        </Link>
        <Link
          to="/admin/categories"
          className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand border-b-2 border-brand flex items-center gap-2"
        >
          <Grid size={15} /> Cây danh mục hệ thống
        </Link>
      </div>
      {error ? (
        <ErrorState error={error} />
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
              {orderedCategories.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium" style={{ paddingLeft: `${12 + depth(item) * 24}px` }}>
                    {depth(item) > 0 ? '↳ ' : ''}{item.name}
                  </td>
                  <td>{item.slug}</td>
                  <td>
                    <Badge tone={item.isActive ? 'success' : 'neutral'}>
                      {item.isActive ? 'Hiển thị' : 'Đã ẩn'}
                    </Badge>
                  </td>
                  <td>
                    <span className="font-semibold text-ink">
                      {categoryProductCountMap.get(item.id) ?? 0}
                    </span>
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
                            await client.invalidateQueries({ queryKey: ['admin-categories'] });
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
                maxLength={150}
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
                maxLength={180}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="field"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </label>
            <label className="form-label">
              Danh mục cha
              <select className="field" value={parentId} onChange={(event) => setParentId(event.target.value)}>
                <option value="">Không có (danh mục gốc)</option>
                {orderedCategories.filter((item) => !editing || !descendants(editing.id).has(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>{'— '.repeat(depth(item))}{item.name}</option>
                  ))}
              </select>
            </label>
            <label className="form-label">
              Mô tả
              <textarea
                className="field"
                maxLength={5000}
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
