import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Truck,
  X,
  ZoomIn,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryService, productService } from '../../services/catalog';
import { categories as seedCategories } from '../../mocks/catalog';
import { bannerService } from '../../services/banners';
import { homeCategoryService } from '../../services/homeCategories';
import { useCartStore } from '../../stores/cartStore';
import { useWishlistStore } from '../../stores/wishlistStore';
import type { Category, HomeBanner, HomeCategoryShowcase, Product, ProductQuery } from '../../types/models';
import { formatCurrency } from '../../utils/format';
import { getPaginationItems } from '../../utils/pagination';
import { getThumbnailUrl, showProductPlaceholder } from '../../utils/images';
import {
  EmptyState,
  ErrorState,
  PageHeading,
  ProductSkeleton,
  SectionHeading,
} from '../../components/common';
import { ProductGrid } from '../../components/ProductCard';
import { PUBLIC_METADATA_GC_MS, PUBLIC_METADATA_STALE_MS, PRODUCT_STALE_MS } from '../../services/cachePolicy';
import { FlyToCart, type CartFlight } from '../../components/FlyToCart';
import { ImageLightboxModal } from '../../components/ImageLightboxModal';
import { ProductReviews } from '../../components/ProductReviews';

function useCatalog(query: ProductQuery, enabled = true) {
  return useQuery({
    queryKey: ['products', query],
    queryFn: () => productService.list(query),
    enabled,
    staleTime: PRODUCT_STALE_MS,
  });
}

export function HomeHeroBanner({ banners }: { banners: HomeBanner[] }) {
  const total = banners.length;
  const [index, setIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [showAlert, setShowAlert] = useState(true);

  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const wheelCooldownRef = useRef(false);

  // Fallback timer for environments where transitionend doesn't fire (e.g. jsdom)
  useEffect(() => {
    if (total <= 1) return;
    if (index === 0) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setIndex(total);
      }, 520);
      return () => clearTimeout(timer);
    }
    if (index === total + 1) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setIndex(1);
      }, 520);
      return () => clearTimeout(timer);
    }
  }, [index, total]);

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setIsTransitioning(true);
    setIndex((prev) => prev + 1);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setIsTransitioning(true);
    setIndex((prev) => prev - 1);
  }, [total]);

  const goToSlide = useCallback((targetIndex: number) => {
    setIsTransitioning(true);
    setIndex(targetIndex + 1);
  }, []);

  // Auto-play timer (pauses when hovered or dragging)
  useEffect(() => {
    if (total <= 1 || isHovered || isDragging) return;
    const timer = window.setInterval(nextSlide, 5500);
    return () => window.clearInterval(timer);
  }, [total, isHovered, isDragging, nextSlide]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (total <= 1) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setDragOffset(0);
    hasDraggedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - pointerStartRef.current.x;
    if (Math.abs(dx) > 6) {
      hasDraggedRef.current = true;
    }
    setDragOffset(dx);
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset < -60) {
      nextSlide();
    } else if (dragOffset > 60) {
      prevSlide();
    }
    setDragOffset(0);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 60);
  };

  const handlePointerCancel = () => {
    setIsDragging(false);
    setDragOffset(0);
    hasDraggedRef.current = false;
  };

  // Horizontal wheel / trackpad scroll left/right to next/prev slide
  const handleWheel = (e: React.WheelEvent) => {
    if (total <= 1) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 25) {
      if (wheelCooldownRef.current) return;
      wheelCooldownRef.current = true;
      setTimeout(() => {
        wheelCooldownRef.current = false;
      }, 500);

      if (e.deltaX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  };

  const handleTransitionEnd = () => {
    if (index >= total + 1) {
      setIsTransitioning(false);
      setIndex(1);
    } else if (index <= 0) {
      setIsTransitioning(false);
      setIndex(total);
    }
  };

  if (total === 0) {
    return (
      <section
        className="relative min-h-[500px] md:min-h-[640px] overflow-hidden bg-ink text-white select-none"
        aria-label="Banner trang chủ"
      >
        <div className="container-shell min-h-[500px] md:min-h-[640px] flex items-center pt-28 sm:pt-36 md:pt-40 pb-12">
          <div className="max-w-xl">
            <span className="text-xs font-black tracking-[0.2em] text-white uppercase bg-brand px-2.5 py-1 inline-block mb-4">
              FASHIONHUB / BỘ SƯU TẬP
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold uppercase tracking-tight">
              Trang phục cho cuộc sống
            </h1>
            <p className="mt-4 mb-8 text-lg text-white/90">
              Đơn giản, tinh tế, không ngừng hoàn thiện để phục vụ cuộc sống của bạn.
            </p>
            <Link className="btn-primary" to="/products">
              MUA SẮM NGAY
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // Extended slides for infinite circular sliding: [last, ...banners, first]
  const extendedSlides = [banners[total - 1], ...banners, banners[0]];
  const realIndex = (index - 1 + total) % total;

  return (
    <section
      className={`relative min-h-[500px] md:min-h-[640px] overflow-hidden bg-ink text-white select-none focus:outline-none ${
        total > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
      }`}
      aria-label="Banner trang chủ"
      aria-roledescription="carousel"
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (isDragging) {
          setIsDragging(false);
          setDragOffset(0);
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onWheel={handleWheel}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevSlide();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextSlide();
        }
      }}
    >
      {/* Uniqlo-style floating alert notice */}
      {showAlert && (
        <div className="absolute top-28 sm:top-36 md:top-40 left-4 sm:left-8 lg:left-12 z-20 max-w-xs sm:max-w-md bg-white/95 backdrop-blur-md text-ink text-xs p-2.5 sm:p-3 rounded-lg shadow-xl border border-slate-200 animate-fade-in flex items-start gap-2.5">
          <div className="flex-1 min-w-0">
            <span className="font-bold text-brand block uppercase text-[11px] tracking-wide mb-0.5">
              Cảnh giác với lừa đảo giao hàng
            </span>
            <p className="text-[11px] leading-relaxed text-slate-700">
              Chỉ thanh toán tiền mặt khi trực tiếp nhận hàng và kiểm tra kiện hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAlert(false)}
            className="text-slate-400 hover:text-ink p-1 -mr-1 -mt-1 rounded-full transition-colors"
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Sliding Track with responsive touch-pan-y */}
      <div
        className="flex h-full w-full touch-pan-y"
        onTransitionEnd={handleTransitionEnd}
        style={{
          transform: `translateX(calc(-${index * 100}% + ${dragOffset}px))`,
          transition:
            isTransitioning && !isDragging
              ? 'transform 550ms cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
        }}
      >
        {extendedSlides.map((banner, i) => {
          const isCurrent = (i - 1 + total) % total === realIndex;
          return (
            <div
              key={`${banner.id}-${i}`}
              className="min-w-full w-full h-full relative shrink-0"
              aria-hidden={!isCurrent}
              role="group"
              aria-roledescription="slide"
              aria-label={`Banner ${((i - 1 + total) % total) + 1} trên ${total}`}
            >
              <img
                src={banner.imageUrl}
                alt={banner.title}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent pointer-events-none" />
              <div className="container-shell relative h-full min-h-[500px] md:min-h-[640px] flex items-center pt-28 sm:pt-36 md:pt-40 pb-12">
                <div className="max-w-2xl py-8">
                  <span className="text-xs font-black tracking-[0.2em] text-white uppercase bg-brand px-2.5 py-1 inline-block mb-4">
                    FASHIONHUB / BỘ SƯU TẬP
                  </span>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-tight leading-[1.08] text-white">
                    {banner.title}
                  </h1>
                  <p className="text-sm sm:text-lg md:text-xl mt-4 mb-8 text-white/90 max-w-xl font-medium leading-relaxed">
                    {banner.subtitle}
                  </p>
                  <Link
                    className="btn-primary inline-flex items-center gap-2"
                    to={banner.linkUrl}
                    onClick={(e) => {
                      if (hasDraggedRef.current) e.preventDefault();
                    }}
                  >
                    {banner.buttonLabel} <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <>
          {/* Prominent Left Arrow Button */}
          <button
            type="button"
            aria-label="Banner trước"
            title="Banner trước (vuốt/cuộn sang trái)"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-black/40 hover:bg-white text-white hover:text-ink backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-200 active:scale-95 group shadow-lg"
          >
            <ChevronLeft size={24} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>

          {/* Prominent Right Arrow Button */}
          <button
            type="button"
            aria-label="Banner tiếp theo"
            title="Banner tiếp theo (vuốt/cuộn sang phải)"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 bg-black/40 hover:bg-white text-white hover:text-ink backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-200 active:scale-95 group shadow-lg"
          >
            <ChevronRight size={24} className="group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Bottom Pagination Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/15">
            {banners.map((_, i) => {
              const active = i === realIndex;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Chuyển đến banner ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(i);
                  }}
                  className={`transition-all duration-300 rounded-full h-2 ${
                    active ? 'w-7 bg-brand' : 'w-2 bg-white/50 hover:bg-white'
                  }`}
                />
              );
            })}
          </div>

          {/* Bottom Counter Box */}
          <div className="absolute bottom-6 right-4 sm:right-6 md:right-12 z-20 flex items-center gap-2.5 bg-black/70 backdrop-blur-sm px-3.5 py-2 text-xs font-bold tracking-widest text-white border border-white/15">
            <button
              type="button"
              aria-label="Banner trước"
              className="p-1 hover:text-brand transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-mono">
              {String(realIndex + 1).padStart(2, '0')} /{' '}
              {String(total).padStart(2, '0')}
            </span>
            <button
              type="button"
              aria-label="Banner tiếp theo"
              className="p-1 hover:text-brand transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function HomeCategorySectionBlock({
  showcase,
  categories,
}: {
  showcase: HomeCategoryShowcase;
  categories: Category[];
}) {
  const showcaseCategory = categories.find((c) => c.id === showcase.categoryId);
  const targetSlug = showcaseCategory?.slug || showcase.category?.slug || '';

  const { data: products = [], isLoading } = useQuery({
    queryKey: [
      'home-category-products',
      showcase.id,
      showcase.selectionMode,
      targetSlug,
      showcase.displayLimit,
      showcase.productIds,
    ],
    queryFn: async () => {
      // 1. Nếu backend đã trả sẵn danh sách sản phẩm
      if (showcase.products && showcase.products.length > 0) {
        return showcase.products;
      }
      // 2. Chế độ chọn sản phẩm cụ thể (CUSTOM)
      if (
        showcase.selectionMode === 'CUSTOM' &&
        showcase.productIds &&
        showcase.productIds.length > 0
      ) {
        const promises = showcase.productIds
          .slice(0, showcase.displayLimit || 8)
          .map((id) => productService.byId(id).catch(() => null));
        const fetched = await Promise.all(promises);
        const valid = fetched.filter((p): p is Product => p !== null);
        if (valid.length > 0) return valid;
      }
      // 3. Chế độ 'ALL': gọi API danh mục công khai
      if (targetSlug) {
        const res = await productService.list({
          category: targetSlug,
          limit: showcase.displayLimit || 8,
          sort: 'newest',
        });
        return res.content;
      }
      return [];
    },
    staleTime: 60_000,
  });

  if (!isLoading && products.length === 0) return null;

  return (
    <div className="mt-16">
      <SectionHeading
        title={showcase.title}
        subtitle={
          showcase.subtitle ||
          `Khám phá các thiết kế mới nhất trong bộ sưu tập ${showcaseCategory?.name || ''}`
        }
        href={targetSlug ? `/categories/${targetSlug}` : '/products'}
        linkText="XEM TẤT CẢ"
      />
      {isLoading ? (
        <ProductSkeleton count={showcase.displayLimit || 8} />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

export function HomePage() {
  const { data: banners = [] } = useQuery({
    queryKey: ['banners'],
    queryFn: bannerService.list,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });

  const { data: categories = seedCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
    placeholderData: seedCategories,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });

  const { data: homeCategories = [] } = useQuery({
    queryKey: ['home-categories'],
    queryFn: homeCategoryService.list,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });

  const { data, isLoading, error } = useCatalog({ limit: 36 });
  const featured = data?.content.slice(0, 8) ?? [];
  const newItems = [...(data?.content ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const sale = data?.content.filter((item) => item.originalPrice).slice(0, 8) ?? [];
  const rootCategories = categories.filter((item) => item.isActive && !item.parentId);

  return (
    <div className="pb-16">
      {/* Full-Width Hero Slider with Swipe, Drag, Wheel Scroll and Navigation */}
      <HomeHeroBanner banners={banners} />

      {/* Brand Philosophy Strip */}
      <section className="border-b border-[#e5e5e5] bg-[#fafafa] py-6 sm:py-8">
        <div className="container-shell grid grid-cols-1 md:grid-cols-3 gap-6 text-center md:text-left">
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <Truck size={28} className="text-brand shrink-0" strokeWidth={1.7} />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                Giao hàng miễn phí toàn quốc
              </h4>
              <p className="text-xs text-[#767676] mt-0.5">Áp dụng cho mọi đơn hàng từ 499.000₫</p>
            </div>
          </div>
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <RotateCcw size={28} className="text-brand shrink-0" strokeWidth={1.7} />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                Đổi trả trong 7 ngày
              </h4>
              <p className="text-xs text-[#767676] mt-0.5">
                Đổi size, mẫu mã thuận tiện tại mọi cửa hàng
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <ShieldCheck size={28} className="text-brand shrink-0" strokeWidth={1.7} />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
                Chất lượng ATINO
              </h4>
              <p className="text-xs text-[#767676] mt-0.5">
                Trang phục thoải mái, dễ phối cho mỗi ngày
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container-shell pt-12 md:pt-16">
        {/* Department Categories Grid */}
        <SectionHeading
          title="DANH MỤC NỔI BẬT"
          subtitle="Khám phá các sản phẩm thiết yếu theo phân loại"
          href="/products"
          linkText="XEM TẤT CẢ DANH MỤC"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-16">
          {rootCategories.map((item) => {
            const descendantIds = new Set([item.id]);
            let changed = true;
            while (changed) {
              changed = false;
              for (const category of categories) {
                if (
                  category.parentId &&
                  descendantIds.has(category.parentId) &&
                  !descendantIds.has(category.id)
                ) {
                  descendantIds.add(category.id);
                  changed = true;
                }
              }
            }
            const sampleProduct = data?.content.find((product) =>
              descendantIds.has(product.categoryId),
            );
            const image = item.imageUrl || sampleProduct?.images[0]?.url;

            return (
              <Link
                to={`/categories/${item.slug}`}
                key={item.id}
                className="category-tile group p-2 text-center"
              >
                <div className="aspect-[3/4] bg-[#f4f4f4] overflow-hidden mb-2 relative">
                  {image ? (
                    <img
                      src={image}
                      alt={item.name}
                      loading="lazy"
                      onError={showProductPlaceholder}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                      FASHIONHUB
                    </div>
                  )}
                </div>
                <strong className="block text-xs sm:text-sm font-bold uppercase tracking-wide text-ink group-hover:text-brand transition-colors">
                  {item.name}
                </strong>
                <span className="text-[11px] text-[#767676] block mt-0.5">Khám phá →</span>
              </Link>
            );
          })}
        </div>

        {/* Featured Products: Hàng Mới Về */}
        <SectionHeading
          title="HÀNG MỚI VỀ"
          subtitle="Bộ sưu tập vừa cập bến với các thiết kế và gam màu mới nhất"
          href="/products?sort=newest"
        />
        {isLoading ? (
          <ProductSkeleton count={8} />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <ProductGrid products={newItems} />
        )}

        {/* Dynamic Admin-Curated Home Category Showcases */}
        {homeCategories.map((showcase) => (
          <HomeCategorySectionBlock
            key={showcase.id}
            showcase={showcase}
            categories={categories}
          />
        ))}

        {/* Red Campaign Promotional Banner */}
        <div className="promo-strip my-16 shadow-lg">
          <div className="max-w-xl">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] bg-white text-brand px-2 py-0.5 inline-block mb-2">
              LIMITED OFFER
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold uppercase tracking-tight text-white mt-1">
              ƯU ĐÃI ĐẶC BIỆT CỦA TUẦN
            </h2>
            <p className="mt-2 text-xs md:text-sm text-white/90 leading-relaxed">
              Trang phục yêu thích với mức giá tốt nhất. Đừng bỏ lỡ các ưu đãi giới hạn thời gian
              dành riêng cho hội viên.
            </p>
          </div>
          <Link
            to="/products?sort=price_asc"
            className="btn-outline bg-white text-ink border-white hover:bg-[#f4f4f4] shrink-0"
          >
            XEM ƯU ĐÃI NGAY <ArrowRight size={16} />
          </Link>
        </div>

        {/* Best Sellers: Sản phẩm bán chạy */}
        <SectionHeading
          title="ĐƯỢC YÊU THÍCH NHẤT"
          subtitle="Các sản phẩm được khách hàng tin dùng và đánh giá cao nhất"
          href="/products?sort=bestselling"
        />
        {isLoading ? (
          <ProductSkeleton count={8} />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <ProductGrid products={featured} />
        )}

        {/* Sale Collection */}
        {sale.length > 0 && (
          <div className="mt-16">
            <SectionHeading
              title="GIÁ TỐT HÔM NAY"
              subtitle="Các món đồ đang được giảm giá với số lượng có hạn"
              href="/products?sort=price_asc"
            />
            <ProductGrid products={sale} />
          </div>
        )}
      </div>
    </div>
  );
}

export function CatalogPage({ mode = 'products' }: { mode?: 'products' | 'search' | 'category' }) {
  const { data: categories = seedCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
    placeholderData: seedCategories,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });

  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // If user lands on a category route with a conflicting ?category query param,
  // seamlessly normalize the route (e.g. /categories/ao-nam?category=phu-kien -> /categories/phu-kien)
  useEffect(() => {
    if (mode === 'category' && params.has('category')) {
      const catParam = params.get('category');
      const next = new URLSearchParams(params);
      next.delete('category');
      next.delete('page');
      const queryStr = next.toString();

      if (catParam && catParam !== slug) {
        navigate(queryStr ? `/categories/${catParam}?${queryStr}` : `/categories/${catParam}`, { replace: true });
      } else if (!catParam) {
        navigate(queryStr ? `/products?${queryStr}` : '/products', { replace: true });
      } else {
        setParams(next, { replace: true });
      }
    }
  }, [mode, slug, params, navigate, setParams]);

  // Active category determination:
  // Query param 'category' takes precedence if explicitly provided; otherwise use route slug if in category mode.
  const queryParamCategory = params.get('category');
  const activeCategory =
    queryParamCategory !== null
      ? (queryParamCategory || undefined)
      : (mode === 'category' ? slug : undefined);

  const query: ProductQuery = {
    category: activeCategory,
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
  const category = categories.find((item) => item.slug === activeCategory);

  // Subcategories to display in horizontal quick pills
  const { currentParentCategory, pillCategories } = useMemo(() => {
    if (!category) {
      // Root level (Tất cả sản phẩm): show top-level parent categories
      return {
        currentParentCategory: undefined,
        pillCategories: categories.filter((c) => !c.parentId && c.isActive !== false),
      };
    }

    // Check if current category is a top-level category with children
    const directChildren = categories.filter((c) => c.parentId === category.id && c.isActive !== false);
    if (directChildren.length > 0) {
      return {
        currentParentCategory: category,
        pillCategories: directChildren,
      };
    }

    // If current category is a subcategory, show its siblings under the same parent
    if (category.parentId) {
      const parent = categories.find((c) => c.id === category.parentId);
      const siblings = categories.filter((c) => c.parentId === category.parentId && c.isActive !== false);
      return {
        currentParentCategory: parent,
        pillCategories: siblings,
      };
    }

    return {
      currentParentCategory: undefined,
      pillCategories: [],
    };
  }, [categories, category]);

  const title =
    mode === 'search'
      ? `Kết quả tìm kiếm cho “${query.q ?? ''}”`
      : activeCategory
        ? (category?.name ?? 'Danh mục')
        : 'TẤT CẢ SẢN PHẨM';

  const selectCategory = (newCategorySlug?: string) => {
    const next = new URLSearchParams(params);
    next.delete('page');

    if (!newCategorySlug) {
      next.delete('category');
      if (mode === 'category') {
        const queryStr = next.toString();
        navigate(queryStr ? `/products?${queryStr}` : '/products');
      } else {
        setParams(next);
      }
      return;
    }

    if (mode === 'category') {
      next.delete('category');
      const queryStr = next.toString();
      navigate(queryStr ? `/categories/${newCategorySlug}?${queryStr}` : `/categories/${newCategorySlug}`);
    } else {
      next.set('category', newCategorySlug);
      setParams(next);
    }
  };

  const update = (name: string, value: string) => {
    if (name === 'category') {
      selectCategory(value);
      return;
    }
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    else if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    setParams(next);
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams();
    if (mode === 'search' && query.q) next.set('q', query.q);
    if (mode === 'category') {
      const queryStr = next.toString();
      navigate(queryStr ? `/products?${queryStr}` : '/products');
    } else {
      setParams(next);
    }
  };

  // Filter definitions
  const sizes = ['M', 'L', 'XL', '2XL', '3XL'];
  const colors = [
    { name: 'Trắng', hex: '#ffffff' },
    { name: 'Kem', hex: '#e6d8c3' },
    { name: 'Đen', hex: '#222222' },
    { name: 'Xanh', hex: '#7893a5' },
    { name: 'Đỏ', hex: '#e60012' },
  ];

  const priceRanges = [
    { label: 'Dưới 300.000 ₫', min: undefined, max: '300000' },
    { label: '300.000 ₫ - 500.000 ₫', min: '300000', max: '500000' },
    { label: '500.000 ₫ - 800.000 ₫', min: '500000', max: '800000' },
    { label: 'Trên 800.000 ₫', min: '800000', max: undefined },
  ];

  const hasActiveFilters = Boolean(
    activeCategory || query.size || query.color || query.minPrice || query.maxPrice,
  );

  // Filter Sidebar Content (shared between Desktop and Mobile)
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Category Accordion / List */}
      <div>
        <h3 className="filter-group-title">DANH MỤC</h3>
        <div className="pt-2 space-y-1">
          <button
            type="button"
            onClick={() => update('category', '')}
            className={`w-full text-left py-1 text-xs font-semibold uppercase transition-colors ${
              !activeCategory ? 'text-brand font-bold' : 'text-[#555] hover:text-ink'
            }`}
          >
            Tất cả danh mục
          </button>
          {categories
            .filter((c) => c.isActive && !c.parentId)
            .map((item) => {
              const isSelected = activeCategory === item.slug;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update('category', isSelected ? '' : item.slug)}
                  className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between ${
                    isSelected ? 'text-brand font-bold' : 'text-[#555] hover:text-ink'
                  }`}
                >
                  <span>{item.name}</span>
                  {isSelected && <Check size={14} className="text-brand" />}
                </button>
              );
            })}
        </div>
      </div>

      {/* Kích cỡ (Size Chips Grid) */}
      <div>
        <h3 className="filter-group-title">KÍCH CỠ</h3>
        <div className="grid grid-cols-3 gap-2 pt-3">
          {sizes.map((s) => {
            const isActive = query.size === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => update('size', isActive ? '' : s)}
                className={`size-chip ${isActive ? 'active' : ''}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Màu sắc (Color Swatches) */}
      <div>
        <h3 className="filter-group-title">MÀU SẮC</h3>
        <div className="flex flex-wrap gap-2.5 pt-3">
          {colors.map((c) => {
            const isActive = query.color === c.name;
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => update('color', isActive ? '' : c.name)}
                className={`color-swatch-dot ${isActive ? 'active' : ''}`}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>

      {/* Mức giá (Price Ranges) */}
      <div>
        <h3 className="filter-group-title">MỨC GIÁ</h3>
        <div className="space-y-1.5 pt-2">
          {priceRanges.map((range) => {
            const isSelected =
              String(query.minPrice ?? '') === (range.min ?? '') &&
              String(query.maxPrice ?? '') === (range.max ?? '');
            return (
              <button
                key={range.label}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  if (isSelected) {
                    next.delete('minPrice');
                    next.delete('maxPrice');
                  } else {
                    if (range.min) next.set('minPrice', range.min);
                    else next.delete('minPrice');
                    if (range.max) next.set('maxPrice', range.max);
                    else next.delete('maxPrice');
                  }
                  next.delete('page');
                  setParams(next);
                }}
                className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between ${
                  isSelected ? 'text-brand font-bold' : 'text-[#555] hover:text-ink'
                }`}
              >
                <span>{range.label}</span>
                {isSelected && <Check size={14} className="text-brand" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-xs font-bold uppercase tracking-wider text-brand hover:underline w-full py-2 text-center border-t border-[#eee] mt-4"
        >
          Xóa tất cả bộ lọc ✕
        </button>
      )}
    </div>
  );

  return (
    <div className="container-shell py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-xs text-[#767676] mb-4">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link to="/" className="hover:text-ink">
              Trang chủ
            </Link>
          </li>
          <li>/</li>
          <li className="text-ink font-semibold">{title}</li>
        </ol>
      </nav>

      {/* Page Heading */}
      <PageHeading
        eyebrow="FASHIONHUB"
        title={title}
        description={
          activeCategory
            ? category?.description
            : 'Khám phá trang phục chất lượng cao, dễ phối hợp cho mọi hoạt động hàng ngày.'
        }
      />

      {/* Horizontal Subcategory Quick Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-[#eee] text-xs">
        <button
          type="button"
          onClick={() => {
            if (currentParentCategory) {
              selectCategory(currentParentCategory.slug);
            } else {
              selectCategory('');
            }
          }}
          className={`px-3 py-1.5 font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
            !currentParentCategory || activeCategory === currentParentCategory.slug
              ? 'bg-ink text-white'
              : 'bg-[#f4f4f4] text-ink hover:bg-slate-200'
          }`}
        >
          TẤT CẢ
        </button>
        {pillCategories.map((cat) => {
          const isActive = activeCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectCategory(cat.slug)}
              className={`px-3 py-1.5 font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                isActive ? 'bg-ink text-white' : 'bg-[#f4f4f4] text-ink hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Top Filter & Sort Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-3 border-b border-[#eee]">
        {/* Mobile Filter Toggle Button */}
        <button
          type="button"
          onClick={() => setMobileFilterOpen(true)}
          className="lg:hidden inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-[#f4f4f4] px-4 py-2 border border-[#ccc]"
        >
          <SlidersHorizontal size={15} />
          BỘ LỌC & SẮP XẾP {hasActiveFilters && '•'}
        </button>

        <span className="text-xs font-semibold text-[#767676]">
          {data?.totalElements ?? 0} SẢN PHẨM
        </span>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#767676] font-semibold uppercase">Sắp xếp:</span>
          <select
            className="field w-40 text-xs py-1.5 font-semibold"
            value={query.sort ?? ''}
            onChange={(event) => update('sort', event.target.value)}
          >
            <option value="">Đặc sắc</option>
            <option value="newest">Hàng mới về</option>
            <option value="bestselling">Bán chạy nhất</option>
            <option value="price_asc">Giá: Thấp đến Cao</option>
            <option value="price_desc">Giá: Cao đến Thấp</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-[#767676] uppercase font-bold">Đang lọc:</span>
          {activeCategory && (
            <span className="inline-flex items-center gap-1 text-xs bg-[#f4f4f4] border border-[#ccc] px-2 py-1 font-semibold">
              Danh mục: {category?.name ?? activeCategory}
              <button
                type="button"
                onClick={() => update('category', '')}
                className="hover:text-brand"
                title="Bỏ lọc danh mục"
              >
                ✕
              </button>
            </span>
          )}
          {query.size && (
            <span className="inline-flex items-center gap-1 text-xs bg-[#f4f4f4] border border-[#ccc] px-2 py-1 font-semibold">
              Size: {query.size}
              <button
                type="button"
                onClick={() => update('size', '')}
                className="hover:text-brand"
              >
                ✕
              </button>
            </span>
          )}
          {query.color && (
            <span className="inline-flex items-center gap-1 text-xs bg-[#f4f4f4] border border-[#ccc] px-2 py-1 font-semibold">
              Màu: {query.color}
              <button
                type="button"
                onClick={() => update('color', '')}
                className="hover:text-brand"
              >
                ✕
              </button>
            </span>
          )}
          {(query.minPrice || query.maxPrice) && (
            <span className="inline-flex items-center gap-1 text-xs bg-[#f4f4f4] border border-[#ccc] px-2 py-1 font-semibold">
              Giá: {query.minPrice ? formatCurrency(query.minPrice) : '0'}{' '}
              {query.maxPrice ? `- ${formatCurrency(query.maxPrice)}` : '+'}
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete('minPrice');
                  next.delete('maxPrice');
                  setParams(next);
                }}
                className="hover:text-brand"
              >
                ✕
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs text-brand hover:underline font-bold ml-2"
          >
            Xóa tất cả
          </button>
        </div>
      )}

      {/* Main Grid: Sidebar + Products */}
      <div className="lg:grid lg:grid-cols-[240px_1fr] gap-8">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden lg:block filter-panel h-fit sticky top-24">
          <div className="flex items-center justify-between pb-3 border-b border-[#eee] mb-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-ink flex items-center gap-2">
              <Filter size={16} /> BỘ LỌC
            </h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-brand hover:underline"
              >
                XÓA TẤT CẢ
              </button>
            )}
          </div>
          <FilterContent />
        </aside>

        {/* Mobile Filter Drawer Modal */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 lg:hidden">
            <div className="bg-white max-h-[85vh] overflow-y-auto p-5 animate-slide-up">
              <div className="flex items-center justify-between pb-4 border-b border-[#eee] mb-4">
                <h3 className="font-black text-base uppercase tracking-wider text-ink">
                  BỘ LỌC SẢN PHẨM
                </h3>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 hover:text-brand"
                >
                  <X size={22} />
                </button>
              </div>
              <FilterContent />
              <div className="mt-6 pt-4 border-t border-[#eee]">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="btn-primary w-full py-3"
                >
                  XEM {data?.totalElements ?? 0} SẢN PHẨM
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Grid Area */}
        <div>
          {isLoading ? (
            <ProductSkeleton count={12} />
          ) : error ? (
            <ErrorState error={error} retry={() => void refetch()} />
          ) : data?.content.length ? (
            <ProductGrid products={data.content} />
          ) : (
            <EmptyState
              title="Không tìm thấy sản phẩm"
              description="Thử thay đổi bộ lọc hoặc tìm kiếm với từ khóa khác."
              action={
                <button type="button" onClick={clearAllFilters} className="btn-primary mt-2">
                  XÓA BỘ LỌC
                </button>
              }
            />
          )}

          {/* Pagination */}
          {(data?.totalPages ?? 0) > 1 && (
            <div className="flex justify-center items-center flex-wrap gap-1.5 sm:gap-2 mt-12 pt-6 border-t border-[#eee]">
              <button
                aria-label="Trang trước"
                disabled={query.page === 1}
                onClick={() => update('page', String(query.page! - 1))}
                className="pager"
              >
                <ChevronLeft size={16} />
              </button>
              {getPaginationItems(query.page || 1, data?.totalPages ?? 1).map((item, index) =>
                typeof item === 'number' ? (
                  <button
                    key={item}
                    onClick={() => update('page', String(item))}
                    className={`pager ${query.page === item ? 'active' : ''}`}
                    aria-label={`Trang ${item}`}
                    aria-current={query.page === item ? 'page' : undefined}
                  >
                    {item}
                  </button>
                ) : (
                  <span
                    key={`dots-${index}`}
                    className="w-8 sm:w-9 h-9 flex items-center justify-center text-sm font-bold text-slate-400 select-none tracking-widest"
                    aria-hidden="true"
                  >
                    ...
                  </span>
                )
              )}
              <button
                aria-label="Trang sau"
                disabled={data?.last}
                onClick={() => update('page', String(query.page! + 1))}
                className="pager"
              >
                <ChevronRight size={16} />
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
    staleTime: PRODUCT_STALE_MS,
  });

  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [flight, setFlight] = useState<CartFlight | null>(null);

  const add = useCartStore((state) => state.add);
  const wishlistIds = useWishlistStore((state) => state.ids);
  const toggleWishlist = useWishlistStore((state) => state.toggle);

  const variant =
    product?.variants.find((item) => item.id === variantId) ??
    product?.variants.find((item) => item.stockQuantity > 0);

  const colors = [...new Set(product?.variants.map((item) => item.color) ?? [])];
  const sizes = [...new Set(product?.variants.map((item) => item.size) ?? [])];
  const selectedColor = variant?.color ?? colors[0];

  // Check if any variant defines its own multi-image gallery (> 1 image)
  const hasVariantGalleries = Boolean(product?.variants.some((v) => (v.images?.length ?? 0) > 1));

  // If a variant defines its own multi-image gallery, use that variant's images.
  // Otherwise, display all images of the product in the thumbnail gallery sidebar!
  const displayImages =
    hasVariantGalleries && variant?.images?.length
      ? variant.images
      : product?.images?.length
        ? product.images
        : variant?.images?.length
          ? variant.images
          : variant?.imageUrl
            ? [{ id: `var-img-${variant.id}`, url: variant.imageUrl, alt: `${product?.name} — ${variant.color}`, isPrimary: true }]
            : [];

  const selectColor = (color: string) => {
    const next =
      product?.variants.find((v) => v.color === color && v.size === (variant?.size ?? sizes[0])) ??
      product?.variants.find((v) => v.color === color);
    if (next) {
      setVariantId(next.id);
      setQuantity(1);
      const targetUrl = next.images?.[0]?.url || next.imageUrl;
      if (targetUrl) {
        const foundIdx = displayImages.findIndex((img) => img.url === targetUrl);
        if (foundIdx !== -1) {
          setActiveImage(foundIdx);
          return;
        }
      }
      setActiveImage(0);
    }
  };

  const selectVariant = (color: string, size: string) => {
    const next = product?.variants.find((item) => item.color === color && item.size === size);
    if (next) {
      setVariantId(next.id);
      setQuantity(1);
      const targetUrl = next.images?.[0]?.url || next.imageUrl;
      if (targetUrl) {
        const foundIdx = displayImages.findIndex((img) => img.url === targetUrl);
        if (foundIdx !== -1) {
          setActiveImage(foundIdx);
          return;
        }
      }
      setActiveImage(0);
    }
  };

  const selectThumbnail = (index: number) => {
    setActiveImage(index);
    const clickedImg = displayImages[index];
    if (clickedImg && product?.variants) {
      const match = product.variants.find(
        (v) => v.images?.[0]?.url === clickedImg.url || v.imageUrl === clickedImg.url
      );
      if (match && match.color !== selectedColor) {
        const next =
          product.variants.find((v) => v.color === match.color && v.size === (variant?.size ?? sizes[0])) ??
          match;
        setVariantId(next.id);
      }
    }
  };

  const buy = (immediate = false, source?: HTMLButtonElement) => {
    if (!product || !variant || variant.stockQuantity < 1) return;
    const cart = document.querySelector('[data-cart-target]');
    const from = source?.getBoundingClientRect();
    const to = cart?.getBoundingClientRect();
    add(product, variant, quantity);
    if (immediate) {
      navigate('/checkout');
    } else if (from && to && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const x = from.left + from.width / 2;
      const y = from.top + from.height / 2;
      setFlight({
        id: crypto.randomUUID(),
        imageUrl: variant.imageUrl || product.images[0]?.url || '',
        x,
        y,
        dx: to.left + to.width / 2 - x,
        dy: to.top + to.height / 2 - y,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container-shell py-12">
        <ProductSkeleton count={4} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container-shell py-12">
        <ErrorState error={error} />
      </div>
    );
  }

  const isLiked = wishlistIds.includes(product.id);
  const compareAtPrice = variant?.compareAtPrice ?? product.originalPrice;
  const discount = compareAtPrice && compareAtPrice > (variant?.price ?? product.minPrice)
    ? Math.round((1 - (variant?.price ?? product.minPrice) / compareAtPrice) * 100)
    : 0;

  return (
    <div className="container-shell py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-[#767676] mb-6">
        <ol className="flex items-center gap-1.5 flex-wrap">
          <li>
            <Link to="/" className="hover:text-ink">
              Trang chủ
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link to="/products" className="hover:text-ink">
              Sản phẩm
            </Link>
          </li>
          <li>/</li>
          <li className="text-ink font-semibold">{product.name}</li>
        </ol>
      </nav>

      {/* Main PDP Grid */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left: Gallery (Thumbnails + Large View) */}
        <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4">
          {/* Thumbnails strip */}
          <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:max-h-[640px] shrink-0 scrollbar-thin pr-1">
            {displayImages.map((image, index) => (
              <button
                key={image.id}
                aria-label={`Xem ảnh ${index + 1}`}
                onClick={() => selectThumbnail(index)}
                className={`w-16 h-20 bg-[#f4f4f4] overflow-hidden border transition-all ${
                  activeImage === index ? 'border-2 border-brand scale-105' : 'border-[#e5e5e5]'
                }`}
              >
                <img
                  src={getThumbnailUrl(image.url)}
                  alt={image.alt}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (image.url && target.src !== image.url) {
                      target.src = image.url;
                    } else {
                      showProductPlaceholder(e);
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* Main Large Image */}
          <div
            className="flex-1 aspect-[3/4] bg-[#f4f4f4] overflow-hidden relative border border-[#eee] cursor-zoom-in group/main-image"
            onClick={() => setIsLightboxOpen(true)}
            role="button"
            tabIndex={0}
            aria-label="Xem ảnh lớn"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsLightboxOpen(true);
              }
            }}
          >
            <img
              data-testid="product-main-image"
              src={displayImages[activeImage]?.url ?? product.images[0]?.url}
              alt={displayImages[activeImage]?.alt ?? product.name}
              onError={showProductPlaceholder}
              className="w-full h-full object-cover transition-transform duration-300 group-hover/main-image:scale-105"
            />
            {discount > 0 && (
              <span className="absolute top-4 left-4 bg-brand text-white text-xs font-black px-2.5 py-1 uppercase tracking-wider">
                {product.promotion?.name ?? 'GIẢM GIÁ'} -{discount}%
              </span>
            )}
            {/* Zoom / Preview Button Overlay */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLightboxOpen(true);
              }}
              aria-label="Phóng to ảnh xem trước"
              className="absolute bottom-3 right-3 z-10 bg-white/90 hover:bg-white text-ink hover:text-brand p-2 sm:p-2.5 rounded-full shadow-md transition-all hover:scale-110 flex items-center gap-1.5 text-xs font-semibold backdrop-blur-sm group/btn"
            >
              <ZoomIn size={16} className="transition-transform group-hover/btn:scale-110" />
              <span className="hidden sm:inline">Phóng to</span>
            </button>
          </div>
        </div>

        {/* Right: Product Purchase Details */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="text-[11px] font-bold text-[#767676] uppercase tracking-wider mb-1">
            MÃ SẢN PHẨM: FH-{product.id.slice(0, 6).toUpperCase()}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold uppercase text-ink tracking-tight leading-snug">
            {product.name}
          </h1>

          {/* Rating and Sold */}
          <div className="flex items-center gap-3 text-xs text-[#767676] mt-3 pb-4 border-b border-[#eee]">
            <span className="flex items-center gap-1 font-bold text-ink">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              {product.ratingAverage}
            </span>
            <span>({product.reviewCount} đánh giá)</span>
            <span>•</span>
            <span>Đã bán {product.soldCount}</span>
          </div>

          {/* Price Box */}
          <div className="py-4 my-2 border-b border-[#eee]">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-black text-brand tracking-tight">
                {formatCurrency(variant?.price ?? product.minPrice)}
              </span>
              {compareAtPrice && discount > 0 && (
                <span className="text-sm text-[#888] line-through font-normal">
                  {formatCurrency(compareAtPrice)}
                </span>
              )}
            </div>
            {discount > 0 && (
              <div className="text-[11px] text-brand font-bold mt-1 uppercase tracking-wider">
                TIẾT KIỆM {formatCurrency(compareAtPrice! - (variant?.price ?? product.minPrice))}
              </div>
            )}
          </div>

          {/* Color Selector */}
          <div className="my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-ink mb-2">
              MÀU SẮC: <span className="font-normal text-[#555]">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => {
                const isSelected = selectedColor === color;
                const sampleVariant = product.variants.find((v) => v.color === color);
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => selectColor(color)}
                    className={`h-10 px-3.5 border text-xs font-semibold uppercase flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'border-2 border-brand bg-[#fff5f5] text-brand font-bold shadow-sm'
                        : 'border-[#ccc] hover:border-ink'
                    }`}
                  >
                    {sampleVariant?.imageUrl ? (
                      <img
                        src={getThumbnailUrl(sampleVariant.imageUrl)}
                        alt=""
                        className="w-5 h-5 object-cover rounded-full border border-black/10"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (sampleVariant.imageUrl && target.src !== sampleVariant.imageUrl) {
                            target.src = sampleVariant.imageUrl;
                          }
                        }}
                      />
                    ) : sampleVariant?.colorCode ? (
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: sampleVariant.colorCode }}
                      />
                    ) : null}
                    {color}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Size Selector */}
          <div className="my-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                KÍCH CỠ: <span className="font-normal text-[#555]">{variant?.size}</span>
              </span>
              <Link to="/size-guide" className="text-xs text-brand font-semibold hover:underline">
                Bảng quy đổi kích cỡ
              </Link>
            </div>
            <div className="flex gap-2">
              {sizes.map((size) => {
                const found = product.variants.find(
                  (item) => item.color === selectedColor && item.size === size,
                );
                const isSelected = variant?.size === size;
                const isOutOfStock = !found || found.stockQuantity < 1;
                return (
                  <button
                    key={size}
                    disabled={isOutOfStock}
                    onClick={() => selectVariant(selectedColor ?? colors[0], size)}
                    className={`size-chip min-w-12 h-11 text-xs font-bold ${
                      isSelected ? 'active' : ''
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stock Availability */}
          <div className="text-xs font-medium my-2 flex items-center gap-2">
            {variant?.stockQuantity ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="text-emerald-700 font-semibold">
                  {variant.stockQuantity > 5
                    ? 'Còn hàng'
                    : `Chỉ còn lại ${variant.stockQuantity} sản phẩm`}
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-600" />
                <span className="text-brand font-semibold">Phiên bản này hiện đã hết hàng</span>
              </>
            )}
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center gap-4 my-4">
            <span className="text-xs font-bold uppercase tracking-wider text-ink">SỐ LƯỢNG</span>
            <div className="inline-flex items-center border border-[#ccc]">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#f4f4f4] transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="w-12 text-center text-sm font-bold">{quantity}</span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={quantity >= (variant?.stockQuantity ?? 1)}
                onClick={() => setQuantity(Math.min(variant?.stockQuantity ?? 1, quantity + 1))}
                className="w-10 h-10 flex items-center justify-center hover:bg-[#f4f4f4] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 mt-2">
            <button
              type="button"
              disabled={!variant?.stockQuantity}
              onClick={(event) => buy(false, event.currentTarget)}
              className="btn-primary w-full py-4 text-sm"
            >
              <ShoppingBag size={18} /> THÊM VÀO GIỎ HÀNG
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!variant?.stockQuantity}
                onClick={() => buy(true)}
                className="btn-secondary w-full py-3 text-xs"
              >
                MUA NGAY
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`btn-outline w-full py-3 text-xs flex items-center justify-center gap-1.5 ${
                  isLiked ? 'text-brand border-brand' : ''
                }`}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                {isLiked ? 'ĐÃ YÊU THÍCH' : 'YÊU THÍCH'}
              </button>
            </div>
          </div>

          {/* LifeWear Commitments */}
          <div className="border-t border-[#eee] mt-6 pt-5 space-y-2.5 text-xs text-[#555]">
            <p className="flex items-center gap-2">
              <Truck size={16} className="text-brand shrink-0" />
              <span>Giao hàng miễn phí toàn quốc cho đơn hàng từ 499.000₫</span>
            </p>
            <p className="flex items-center gap-2">
              <RotateCcw size={16} className="text-brand shrink-0" />
              <span>Đổi trả thuận tiện tại hệ thống cửa hàng trong 7 ngày</span>
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand shrink-0" />
              <span>Cam kết sản phẩm FashionHub chính hãng 100%</span>
            </p>
          </div>
        </div>
      </div>

      {/* Product Details & Specifications */}
      <div className="mt-14 border-t border-[#e5e5e5] pt-10">
        <h2 className="text-xl font-extrabold uppercase tracking-tight text-ink mb-4">
          THÔNG TIN SẢN PHẨM
        </h2>
        <div className="grid md:grid-cols-2 gap-8 text-sm text-[#444] leading-relaxed">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-ink mb-2">
              TỔNG QUAN THIẾT KẾ
            </h3>
            <p>{product.description}</p>
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-ink mb-2">
              CHẤT LIỆU & HƯỚNG DẪN GIẶT ỦI
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#555]">
              <li>Chất liệu: 100% sợi tự nhiên tuyển chọn, thoáng khí và mềm mại.</li>
              <li>Giặt máy bằng nước lạnh với chu kỳ nhẹ nhàng.</li>
              <li>Không sử dụng thuốc tẩy có chứa clo.</li>
              <li>Ủi ở nhiệt độ trung bình nếu cần thiết.</li>
            </ul>
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} />

      {/* Related Products Recommendation */}
      <div className="mt-16 border-t border-[#e5e5e5] pt-10">
        <SectionHeading title="CÓ THỂ BẠN CŨNG THÍCH" href="/products" />
        <RelatedProducts categoryId={product.categoryId} exclude={product.id} />
      </div>

      {flight && <FlyToCart key={flight.id} flight={flight} onDone={() => setFlight(null)} />}

      {/* Product Image Lightbox Modal with Zoom in/out, Next/Back & Filmstrip */}
      <ImageLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        images={displayImages}
        initialIndex={activeImage}
        productName={product.name}
        onIndexChange={(newIdx) => setActiveImage(newIdx)}
      />
    </div>
  );
}

function RelatedProducts({ categoryId, exclude }: { categoryId: string; exclude: string }) {
  const { data: categories = seedCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
    placeholderData: seedCategories,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });
  const category = categories.find((item) => item.id === categoryId);
  const { data } = useCatalog({ category: category?.slug, limit: 6 }, !!category);
  return (
    <ProductGrid
      products={data?.content.filter((item) => item.id !== exclude).slice(0, 4) ?? []}
    />
  );
}
