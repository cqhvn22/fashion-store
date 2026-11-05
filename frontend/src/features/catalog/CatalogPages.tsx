import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Truck,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { categoryService, productService } from '../../services/catalog';
import { useCartStore } from '../../stores/cartStore';
import type { ProductQuery } from '../../types/models';
import { formatCurrency } from '../../utils/format';
import {
  EmptyState,
  ErrorState,
  PageHeading,
  ProductSkeleton,
  SectionHeading,
} from '../../components/common';
import { ProductGrid } from '../../components/ProductCard';
import { FlyToCart, type CartFlight } from '../../components/FlyToCart';

function useCatalog(query: ProductQuery) {
  return useQuery({ queryKey: ['products', query], queryFn: () => productService.list(query) });
}
export function HomePage() {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const { data, isLoading, error } = useCatalog({ limit: 36 });
  const featured = data?.content.slice(0, 8) ?? [];
  const newItems = [...(data?.content ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const sale = data?.content.filter((item) => item.originalPrice).slice(12, 16) ?? [];
  return (
    <>
      <section className="hero">
        <div className="container-shell grid lg:grid-cols-2 items-center gap-8 py-12 md:py-20">
          <div className="max-w-xl">
            <span className="eyebrow text-brand">BỘ SƯU TẬP 2026</span>
            <h1 className="hero-title">
              Phong cách của bạn,
              <br />
              <em>mỗi ngày một mới.</em>
            </h1>
            <p className="text-slate-600 text-lg mt-5 mb-7 leading-7">
              Khám phá những thiết kế dễ mặc, chất lượng và vừa vặn với nhịp sống hiện đại.
            </p>
            <Link className="btn-primary inline-flex items-center gap-2" to="/products">
              Mua sắm ngay <ArrowRight size={18} />
            </Link>
            <div className="flex gap-8 mt-10 text-sm text-slate-600">
              <span>
                <strong className="block text-2xl text-ink">36+</strong>Sản phẩm
              </span>
              <span>
                <strong className="block text-2xl text-ink">6</strong>Danh mục
              </span>
              <span>
                <strong className="block text-2xl text-ink">7 ngày</strong>Đổi size
              </span>
            </div>
          </div>
          <div className="hero-image">
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=85"
              alt="Bộ sưu tập thời trang FashionHub"
            />
            <div className="hero-note">
              EVERYDAY
              <br />
              EDIT <span>— 2026</span>
            </div>
          </div>
        </div>
      </section>
      <div className="container-shell py-12">
        <SectionHeading title="Mua sắm theo danh mục" href="/products" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-14">
          {categories.map((item, index) => (
            <Link to={`/categories/${item.slug}`} key={item.id} className="category-tile">
              <span className="text-3xl mb-3">{['✿', '◈', '◇', '▣', '◐', '✦'][index]}</span>
              <strong>{item.name}</strong>
              <small>Khám phá →</small>
            </Link>
          ))}
        </div>
        <SectionHeading title="Được yêu thích" href="/products?sort=bestselling" />
        {isLoading ? (
          <ProductSkeleton />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <ProductGrid products={featured} />
        )}
        <div className="promo-strip my-14">
          <div>
            <span className="eyebrow text-[#ffe9dc]">ƯU ĐÃI MỖI NGÀY</span>
            <h2 className="text-2xl md:text-3xl font-bold mt-2">
              Phong cách mới, giá thật dễ yêu.
            </h2>
            <p className="mt-2 text-white/80">
              Tìm món đồ bạn thích trong bộ sưu tập đang giảm giá.
            </p>
          </div>
          <Link
            to="/products?sort=price_asc"
            className="bg-white text-brand px-5 py-3 rounded font-semibold"
          >
            Khám phá <ArrowRight className="inline" size={16} />
          </Link>
        </div>
        <SectionHeading title="Vừa lên kệ" href="/products?sort=newest" />
        <ProductGrid products={newItems} />
        <div className="mt-14">
          <SectionHeading title="Giá tốt hôm nay" href="/products?sort=price_asc" />
          <ProductGrid products={sale} />
        </div>
      </div>
    </>
  );
}
export function CatalogPage({ mode = 'products' }: { mode?: 'products' | 'search' | 'category' }) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const query: ProductQuery = {
    category: mode === 'category' ? slug : (params.get('category') ?? undefined),
    q: mode === 'search' ? (params.get('q') ?? undefined) : undefined,
    minPrice: Number(params.get('minPrice')) || undefined,
    maxPrice: Number(params.get('maxPrice')) || undefined,
    size: params.get('size') ?? undefined,
    color: params.get('color') ?? undefined,
    sort: params.get('sort') ?? undefined,
    page: Number(params.get('page')) || 1,
    limit: 12,
  };
  const { data, isLoading, error, refetch } = useCatalog(query);
  const category = categories.find((item) => item.slug === slug);
  const title =
    mode === 'search'
      ? `Kết quả cho “${query.q ?? ''}”`
      : mode === 'category'
        ? (category?.name ?? 'Danh mục')
        : 'Tất cả sản phẩm';
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next);
  };
  return (
    <div className="container-shell py-10">
      <PageHeading
        eyebrow="FASHIONHUB COLLECTION"
        title={title}
        description={
          mode === 'category' ? category?.description : 'Tìm món đồ phù hợp với phong cách của bạn.'
        }
      />
      <div className="lg:grid lg:grid-cols-[230px_1fr] gap-7">
        <aside className="filter-panel h-fit mb-6 lg:mb-0">
          <h2 className="font-bold text-lg mb-5">Bộ lọc</h2>
          <label className="filter-label">
            Danh mục
            <select
              value={query.category ?? ''}
              disabled={mode === 'category'}
              onChange={(event) => update('category', event.target.value)}
              className="field"
            >
              <option value="">Tất cả</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            Giá từ
            <select
              value={query.minPrice ?? ''}
              onChange={(event) => update('minPrice', event.target.value)}
              className="field"
            >
              <option value="">Không giới hạn</option>
              <option value="200000">200.000₫</option>
              <option value="400000">400.000₫</option>
              <option value="600000">600.000₫</option>
            </select>
          </label>
          <label className="filter-label">
            Giá đến
            <select
              value={query.maxPrice ?? ''}
              onChange={(event) => update('maxPrice', event.target.value)}
              className="field"
            >
              <option value="">Không giới hạn</option>
              <option value="300000">300.000₫</option>
              <option value="500000">500.000₫</option>
              <option value="800000">800.000₫</option>
            </select>
          </label>
          <label className="filter-label">
            Kích cỡ
            <select
              value={query.size ?? ''}
              onChange={(event) => update('size', event.target.value)}
              className="field"
            >
              <option value="">Tất cả</option>
              {['S', 'M', 'L', 'Một cỡ'].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            Màu sắc
            <select
              value={query.color ?? ''}
              onChange={(event) => update('color', event.target.value)}
              className="field"
            >
              <option value="">Tất cả</option>
              {['Trắng', 'Xanh', 'Kem', 'Đen'].map((color) => (
                <option key={color}>{color}</option>
              ))}
            </select>
          </label>
          <button
            className="text-sm text-brand mt-3"
            onClick={() => setParams(new URLSearchParams())}
          >
            Xóa bộ lọc
          </button>
        </aside>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <span className="text-sm text-slate-500">{data?.totalElements ?? 0} sản phẩm</span>
            <label className="text-sm flex gap-2 items-center">
              Sắp xếp
              <select
                className="field w-44"
                value={query.sort ?? ''}
                onChange={(event) => update('sort', event.target.value)}
              >
                <option value="">Mặc định</option>
                <option value="newest">Mới nhất</option>
                <option value="bestselling">Bán chạy</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
              </select>
            </label>
          </div>
          {isLoading ? (
            <ProductSkeleton />
          ) : error ? (
            <ErrorState error={error} retry={() => void refetch()} />
          ) : data?.content.length ? (
            <ProductGrid products={data.content} />
          ) : (
            <EmptyState
              title="Không tìm thấy sản phẩm"
              description="Thử thay đổi từ khóa hoặc bộ lọc."
            />
          )}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex justify-center items-center gap-4 mt-9">
              <button
                aria-label="Trang trước"
                disabled={query.page === 1}
                onClick={() => update('page', String(query.page! - 1))}
                className="pager"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm">
                Trang {query.page} / {data?.totalPages}
              </span>
              <button
                aria-label="Trang sau"
                disabled={data?.last}
                onClick={() => update('page', String(query.page! + 1))}
                className="pager"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => productService.bySlug(slug!),
    enabled: !!slug,
  });
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [flight, setFlight] = useState<CartFlight | null>(null);
  const add = useCartStore((state) => state.add);
  const variant =
    product?.variants.find((item) => item.id === variantId) ??
    product?.variants.find((item) => item.stockQuantity > 0);
  const colors = [...new Set(product?.variants.map((item) => item.color) ?? [])];
  const sizes = [...new Set(product?.variants.map((item) => item.size) ?? [])];
  const selectedColor = variant?.color;
  const selectVariant = (color: string, size: string) => {
    const next = product?.variants.find((item) => item.color === color && item.size === size);
    if (next) {
      setVariantId(next.id);
      setQuantity(1);
    }
  };
  const buy = (immediate = false, source?: HTMLButtonElement) => {
    if (!product || !variant || variant.stockQuantity < 1) return;
    const cart = document.querySelector('[data-cart-target]');
    const from = source?.getBoundingClientRect();
    const to = cart?.getBoundingClientRect();
    add(product, variant, quantity);
    if (immediate) navigate('/checkout');
    else if (from && to && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const x = from.left + from.width / 2;
      const y = from.top + from.height / 2;
      setFlight({
        id: crypto.randomUUID(),
        imageUrl: product.images[0]?.url ?? '',
        x,
        y,
        dx: to.left + to.width / 2 - x,
        dy: to.top + to.height / 2 - y,
      });
    }
  };
  if (isLoading)
    return (
      <div className="container-shell py-10">
        <ProductSkeleton />
      </div>
    );
  if (error || !product)
    return (
      <div className="container-shell py-10">
        <ErrorState error={error} />
      </div>
    );
  return (
    <div className="container-shell py-8">
      <div className="text-sm text-slate-500 mb-6">
        <Link to="/">Trang chủ</Link> / <Link to="/products">Sản phẩm</Link> / {product.name}
      </div>
      <div className="grid lg:grid-cols-2 gap-9 bg-white p-4 md:p-7 rounded">
        <div>
          <div className="aspect-[4/5] bg-[#eeeae3] overflow-hidden rounded">
            <img
              src={product.images[activeImage]?.url}
              alt={product.images[activeImage]?.alt}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-2 mt-3">
            {product.images.map((image, index) => (
              <button
                key={image.id}
                aria-label={`Xem ảnh ${index + 1}`}
                onClick={() => setActiveImage(index)}
                className={`w-16 h-20 border-2 ${activeImage === index ? 'border-brand' : 'border-transparent'}`}
              >
                <img src={image.url} alt={image.alt} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div className="py-2">
          <span className="eyebrow text-brand">FASHIONHUB · EVERYDAY EDIT</span>
          <h1 className="text-3xl font-bold mt-2">{product.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-4">
            <span className="flex items-center gap-1 text-amber-600">
              <Star size={16} fill="currentColor" /> {product.ratingAverage}
            </span>
            <span>{product.reviewCount} đánh giá</span>
            <span>Đã bán {product.soldCount}</span>
          </div>
          <div className="bg-[#fff7f4] rounded p-5 my-7">
            <strong className="text-3xl text-brand">
              {formatCurrency(variant?.price ?? product.minPrice)}
            </strong>
            <span className="text-slate-400 line-through ml-3">
              {product.originalPrice && formatCurrency(product.originalPrice)}
            </span>
          </div>
          <p className="text-slate-600 leading-7 mb-6">{product.description}</p>
          <div className="mb-5">
            <div className="font-semibold mb-2">
              Màu sắc: <span className="font-normal">{selectedColor}</span>
            </div>
            <div className="flex gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => selectVariant(color, variant?.size ?? sizes[0])}
                  className={`option-btn ${selectedColor === color ? 'option-selected' : ''}`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-5">
            <div className="font-semibold mb-2">
              Kích cỡ{' '}
              <Link to="/size-guide" className="text-sm text-brand font-normal ml-3">
                Hướng dẫn chọn size
              </Link>
            </div>
            <div className="flex gap-2">
              {sizes.map((size) => {
                const found = product.variants.find(
                  (item) => item.color === selectedColor && item.size === size,
                );
                return (
                  <button
                    key={size}
                    disabled={!found?.stockQuantity}
                    onClick={() => selectVariant(selectedColor ?? colors[0], size)}
                    className={`option-btn ${variant?.size === size ? 'option-selected' : ''}`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="text-sm text-slate-500 mb-5">
            {variant?.stockQuantity
              ? `Còn ${variant.stockQuantity} sản phẩm`
              : 'Phiên bản này đã hết hàng'}
          </div>
          <div className="flex items-center gap-4 mb-7">
            <span className="font-semibold">Số lượng</span>
            <div className="quantity-control">
              <button
                aria-label="Giảm số lượng"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label="Tăng số lượng"
                onClick={() => setQuantity(Math.min(variant?.stockQuantity ?? 1, quantity + 1))}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={!variant?.stockQuantity}
              onClick={(event) => buy(false, event.currentTarget)}
              className="btn-outline flex items-center gap-2"
            >
              <ShoppingBag size={18} />
              Thêm vào giỏ
            </button>
            <button
              disabled={!variant?.stockQuantity}
              onClick={() => buy(true)}
              className="btn-primary"
            >
              Mua ngay
            </button>
          </div>
          <div className="border-t mt-8 pt-5 text-sm text-slate-600 space-y-3">
            <p className="flex gap-2">
              <Truck size={18} /> Giao hàng toàn quốc, miễn phí từ 500.000₫
            </p>
            <p className="flex gap-2">
              <Check size={18} /> Hỗ trợ đổi size trong 7 ngày
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded mt-7">
        <h2 className="text-xl font-bold mb-3">Chi tiết sản phẩm</h2>
        <p className="text-slate-600 leading-7">{product.description}</p>
      </div>
      <div className="mt-10">
        <SectionHeading title="Có thể bạn cũng thích" href="/products" />
        <RelatedProducts categoryId={product.categoryId} exclude={product.id} />
      </div>
      {flight && <FlyToCart key={flight.id} flight={flight} onDone={() => setFlight(null)} />}
    </div>
  );
}
function RelatedProducts({ categoryId, exclude }: { categoryId: string; exclude: string }) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const category = categories.find((item) => item.id === categoryId);
  const { data } = useCatalog({ category: category?.slug, limit: 6 });
  return (
    <ProductGrid products={data?.content.filter((item) => item.id !== exclude).slice(0, 4) ?? []} />
  );
}
