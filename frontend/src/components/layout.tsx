import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  BadgePercent,
  Bot,
  Boxes,
  ChevronDown,
  ClipboardList,
  Heart,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import { categoryService, productService } from '../services/catalog';
import { categories as seedCategories, seedProducts } from '../mocks/catalog';
import { atinoCategories } from '../data/atinoCatalog';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { useWishlistStore } from '../stores/wishlistStore';
import { ChatWidget } from '../features/chat/ChatWidget';
import type { Category } from '../types/models';
import { NotificationBell } from './NotificationBell';
import { NotificationToast } from './NotificationToast';
import { getThumbnailUrl, showOriginalOrPlaceholder } from '../utils/images';
import { PUBLIC_METADATA_GC_MS, PUBLIC_METADATA_STALE_MS } from '../services/cachePolicy';

const CATEGORY_THUMBNAILS_CACHE_KEY = 'fashionhub_category_thumbnails_cache_v2';
const defaultCategoryImages = new Map(
  atinoCategories.filter((category) => category.imageUrl).map((category) => [category.slug, category.imageUrl]),
);

interface CachedCategoryThumbnail {
  imageUrl: string;
  signature: string;
}

function getStoredCategoryThumbnails(): Record<string, CachedCategoryThumbnail> {
  try {
    const raw = localStorage.getItem(CATEGORY_THUMBNAILS_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CachedCategoryThumbnail>;
  } catch {
    return {};
  }
}

function saveStoredCategoryThumbnails(data: Record<string, CachedCategoryThumbnail>) {
  try {
    localStorage.setItem(CATEGORY_THUMBNAILS_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota error
  }
}

export function Header() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [openedCategories, setOpenedCategories] = useState<Set<string>>(() => new Set());
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const { data: categories = seedCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
    placeholderData: seedCategories,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });

  const needsProductImages = categories.some((category) => category.isActive && category.parentId &&
    (!category.imageUrl || category.imageUrl === '/images/product-placeholder.svg') &&
    !defaultCategoryImages.has(category.slug));
  const { data: allProducts = seedProducts } = useQuery({
    queryKey: ['header-products'],
    queryFn: async () => {
      try {
        const res = await productService.list({ limit: 100 });
        return res.content.length > 0 ? res.content : seedProducts;
      } catch {
        return seedProducts;
      }
    },
    enabled: needsProductImages,
    staleTime: PUBLIC_METADATA_STALE_MS,
    gcTime: PUBLIC_METADATA_GC_MS,
  });

  // Map each leaf subcategory (con nhất) to a category image or product image, cached in localStorage
  const categoryImageMap = useMemo(() => {
    const cached = getStoredCategoryThumbnails();
    let hasChanges = false;
    const nextCache: Record<string, CachedCategoryThumbnail> = { ...cached };
    const resultMap: Record<string, string> = {};

    for (const cat of categories) {
      const catDirectImage =
        (cat.imageUrl && cat.imageUrl !== '/images/product-placeholder.svg' ? cat.imageUrl : null) ||
        defaultCategoryImages.get(cat.slug) || null;
      const matching = allProducts.filter((p) => p.categoryId === cat.id);
      // Chữ ký đại diện cho danh mục và danh sách sản phẩm hiện tại
      const currentSignature = `${catDirectImage || ''}_${matching.map((p) => p.id).sort().join(',')}`;
      const existing = cached[cat.id];

      if (
        existing &&
        existing.signature === currentSignature &&
        existing.imageUrl &&
        existing.imageUrl !== '/images/product-placeholder.svg'
      ) {
        // Tái sử dụng thumbnail đã lưu trong localStorage - không cần random hay tải lại ảnh mới
        resultMap[cat.id] = existing.imageUrl;
      } else {
        hasChanges = true;
        let pickedImage = catDirectImage;
        if (!pickedImage && matching.length > 0) {
          pickedImage = [...matching].sort((a, b) => a.id.localeCompare(b.id))[0].images[0]?.url || null;
        }
        if (!pickedImage) {
          const fallback = allProducts.find(
            (p) =>
              p.slug.includes(cat.slug) ||
              (p.categoryId && p.categoryId.includes(cat.slug))
          );
          if (fallback?.images?.[0]?.url) {
            pickedImage = fallback.images[0].url;
          }
        }
        const finalImage = pickedImage || '/images/product-placeholder.svg';
        nextCache[cat.id] = {
          imageUrl: finalImage,
          signature: currentSignature,
        };
        resultMap[cat.id] = finalImage;
      }
    }

    if (hasChanges) {
      saveStoredCategoryThumbnails(nextCache);
    }

    return resultMap;
  }, [categories, allProducts]);

  const handleCategoryHover = (catId: string | null, delay = 0) => {
    clearHoverTimeout();
    if (catId) {
      setOpenedCategories((opened) => opened.has(catId) ? opened : new Set(opened).add(catId));
      setHoveredCategory(catId);
    } else {
      if (delay > 0) {
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredCategory(null);
        }, delay);
      } else {
        setHoveredCategory(null);
      }
    }
  };

  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isMenuOpen = Boolean(hoveredCategory) || open;
  const isHome = location.pathname === '/';
  const isTransparent = isHome && !scrolled && !isMenuOpen;

  useEffect(() => {
    return () => {
      clearHoverTimeout();
    };
  }, []);

  useEffect(() => {
    clearHoverTimeout();
    setOpen(false);
    setExpandedCategory(null);
    setHoveredCategory(null);
    setShowSearchSuggestions(false);
    setShowUserMenu(false);
  }, [location.pathname, location.search]);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearchSuggestions(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        clearHoverTimeout();
        setHoveredCategory(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const count = useCartStore((state) => state.items.length);
  const wishlistCount = useWishlistStore((state) => state.ids.length);

  const roots = categories.filter((item) => item.isActive && !item.parentId);
  const women = roots.find((item) => item.name.toLocaleLowerCase('vi').includes('nữ'));
  const men = roots.find((item) => item.name.toLocaleLowerCase('vi').includes('nam'));
  const rootNavItems = [
    women,
    men,
    ...roots.filter((item) => item.id !== women?.id && item.id !== men?.id),
  ].filter((item): item is Category => !!item);

  const closeMenus = () => {
    clearHoverTimeout();
    setOpen(false);
    setExpandedCategory(null);
    setHoveredCategory(null);
    setShowSearchSuggestions(false);
    setShowUserMenu(false);
  };

  const popularKeywords = [
    'Áo polo',
    'Áo thun basic',
    'Quần Smart Pants',
    'Áo khoác chống UV',
    'AIRism',
    'Linen',
    'Đầm maxi',
  ];

  const handleSearchSubmit = (searchTerm: string) => {
    const q = searchTerm.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    closeMenus();
  };

  const searchForm = (mobile = false) => (
    <div
      ref={!mobile ? searchContainerRef : undefined}
      className={`relative ${
        mobile
          ? 'flex lg:hidden w-full my-2'
          : 'hidden sm:flex flex-1 min-w-[190px] max-w-[220px] md:max-w-[260px] lg:max-w-[300px] xl:max-w-[340px] ml-auto mr-1 sm:mr-3'
      }`}
    >
      <form
        className={`search-box w-full ${
          isTransparent
            ? 'bg-white/95 backdrop-blur-sm border-white/60 text-ink shadow-sm focus-within:bg-white focus-within:ring-2 focus-within:ring-white/80'
            : 'border-[#ccc] bg-[#f8f8f8] focus-within:border-ink focus-within:bg-white'
        }`}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          handleSearchSubmit(term);
        }}
      >
        <input
          aria-label="Tìm kiếm sản phẩm"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => setShowSearchSuggestions(true)}
          placeholder="Bạn đang tìm sản phẩm gì?"
          className="min-w-0 flex-1 outline-none bg-transparent text-xs sm:text-sm placeholder:text-[#666] text-ink"
        />
        <button
          type="submit"
          className="search-submit"
          aria-label="Tìm kiếm"
          title="Tìm kiếm"
        >
          <Search size={17} strokeWidth={2} />
        </button>
      </form>

      {/* Search Suggestions Dropdown */}
      {showSearchSuggestions && !mobile && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#ccc] shadow-xl p-4 z-50 animate-fade-in text-ink">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#767676] mb-2">
            Từ khóa phổ biến
          </div>
          <div className="flex flex-wrap gap-1.5">
            {popularKeywords.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => {
                  setTerm(kw);
                  handleSearchSubmit(kw);
                }}
                className="text-xs bg-[#f4f4f4] hover:bg-ink hover:text-white px-2.5 py-1 text-ink transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <header
      ref={headerRef}
      className={`site-header fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isTransparent
          ? 'site-header-transparent text-white border-transparent'
          : 'bg-white text-ink border-b border-[#e5e5e5] shadow-md'
      }`}
    >
      {/* Top Utility & Announcement Bar */}
      <div
        className={`site-topbar transition-colors duration-300 ${
          isTransparent
            ? 'bg-transparent text-white/90 border-b border-white/10'
            : 'bg-[#f4f4f4] text-[#444] border-b border-[#eaeaea]'
        }`}
      >
        <div className="container-shell flex items-center justify-between gap-4 py-1 text-[11px] sm:text-xs">
          <div className={`flex items-center gap-2 font-semibold tracking-wide truncate ${isTransparent ? 'text-white' : 'text-ink'}`}>
            <span className="inline-block w-2 h-2 bg-brand rounded-full animate-pulse" />
            <span>GIAO HÀNG MIỄN PHÍ TOÀN QUỐC CHO MỌI ĐƠN HÀNG TỪ 499.000 Đ</span>
          </div>
          <div className={`hidden md:flex items-center gap-5 font-semibold ${isTransparent ? 'text-white/80' : 'text-[#555]'}`}>
            <Link to="/policies/returns" className="hover:text-brand transition-colors">
              Đổi trả dễ dàng 7 ngày
            </Link>
            <Link to="/about" className="hover:text-brand transition-colors">
              Trợ giúp & FAQ
            </Link>
          </div>
        </div>
      </div>

      {/* Main Single Header Row (Compact Uniqlo Layout) */}
      <div className="container-shell flex items-center justify-between gap-2 sm:gap-4 py-1.5 sm:py-2">
        {/* Left: Mobile Toggle + Red Square Logo + Inline Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 xl:gap-5 min-w-0">
          {/* Mobile Hamburger Button */}
          <button
            className={`header-icon-button lg:hidden ${isTransparent ? 'text-white hover:bg-white/15' : 'text-ink'}`}
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
            aria-controls="shop-navigation"
            onClick={() => (open ? closeMenus() : setOpen(true))}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* FashionHub Brand Logo (Red Square) */}
          <Link
            to="/"
            className="brand-logo-wrap shrink-0"
            onClick={closeMenus}
            aria-label="FashionHub - Trang chủ"
          >
            <div className="brand-badge">
              <span>FASHION</span>
              <span>HUB</span>
            </div>
          </Link>

          {/* Navigation Bar (Inline on Desktop, Mobile Drawer on Mobile) */}
          <nav
            id="shop-navigation"
            className={`shop-nav ${
              open
                ? 'fixed inset-x-0 top-[66px] sm:top-[72px] bottom-0 bg-white z-50 overflow-y-auto p-4 flex flex-col gap-2 shadow-2xl border-t border-slate-200'
                : 'hidden'
            } lg:flex lg:static lg:bg-transparent lg:border-none lg:shadow-none lg:p-0 lg:flex-row lg:items-center lg:gap-0.5 xl:gap-1.5`}
          >
            {/* Mobile Search Box */}
            {open && searchForm(true)}

            {/* Department Categories with Mega-Menu (Uniqlo Style) */}
            {rootNavItems.map((item) => {
              const label = item.name;
              const children = categories.filter(
                (child) => child.parentId === item.id && child.isActive,
              );

              return (
                <div
                  key={item.id}
                  className="nav-group group"
                  onMouseEnter={() => handleCategoryHover(item.id)}
                  onMouseLeave={() => handleCategoryHover(null, 300)}
                  onFocus={() => handleCategoryHover(item.id)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      handleCategoryHover(null, 150);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <NavLink
                      className={({ isActive }) =>
                        `header-nav-link ${
                          isActive || hoveredCategory === item.id ? 'active nav-hovered' : ''
                        }`
                      }
                      to={`/categories/${item.slug}`}
                      onClick={closeMenus}
                    >
                      {({ isActive }) => (
                        <span className="relative py-0.5">
                          {label}
                          {(hoveredCategory === item.id || isActive) && (
                            <span className="nav-link-underline" />
                          )}
                        </span>
                      )}
                    </NavLink>
                    {children.length > 0 && (
                      <button
                        type="button"
                        className="lg:hidden p-3 text-stone-500 hover:text-ink"
                        aria-label={`${expandedCategory === item.id ? 'Thu gọn' : 'Mở'} danh mục ${label}`}
                        aria-expanded={expandedCategory === item.id}
                        onClick={() => {
                          setOpenedCategories((opened) => opened.has(item.id) ? opened : new Set(opened).add(item.id));
                          setExpandedCategory(expandedCategory === item.id ? null : item.id);
                        }}
                      >
                        <ChevronDown
                          size={18}
                          className={`transition-transform ${
                            expandedCategory === item.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {/* Mega-Menu Dropdown */}
                  {children.length > 0 && openedCategories.has(item.id) && (
                    <div
                      className={`nav-dropdown text-ink bg-white ${
                        expandedCategory === item.id ? 'block' : 'hidden'
                      } ${hoveredCategory === item.id ? 'lg:block' : 'lg:hidden'}`}
                      aria-hidden={hoveredCategory !== item.id && expandedCategory !== item.id}
                      onMouseEnter={() => handleCategoryHover(item.id)}
                      onMouseLeave={() => handleCategoryHover(null, 300)}
                    >
                      <div className="container-shell py-6 sm:py-8">
                        {/* Header of the mega menu */}
                        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-5 bg-brand rounded-full inline-block" />
                            <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-ink">
                              {item.name}
                            </h3>
                            <span className="text-xs text-slate-500 font-medium">
                              ({children.length} nhóm sản phẩm)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={closeMenus}
                            className="text-slate-400 hover:text-ink p-1.5 rounded-full hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-semibold"
                            aria-label="Đóng danh mục"
                          >
                            <span>Đóng</span>
                            <X size={15} />
                          </button>
                        </div>

                        {/* Subcategories Grid with Random Product Images (leaf categories) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-5">
                          {children.map((sub) => {
                            const rawImgUrl =
                              (sub.imageUrl && sub.imageUrl !== '/images/product-placeholder.svg'
                                ? sub.imageUrl
                                : null) ||
                              categoryImageMap[sub.id] ||
                              '/images/product-placeholder.svg';
                            const imgUrl = getThumbnailUrl(rawImgUrl);
                            return (
                              <Link
                                key={sub.id}
                                to={`/categories/${sub.slug}`}
                                onClick={closeMenus}
                                className="flex flex-col items-center text-center group/cat p-2.5 sm:p-3 rounded-2xl hover:bg-slate-50 hover:shadow-sm transition-all"
                              >
                                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl bg-[#f7f7f8] flex items-center justify-center p-2 mb-2 shadow-sm border border-slate-100 group-hover/cat:scale-105 group-hover/cat:shadow-md transition-all duration-200 overflow-hidden">
                                  <img
                                    src={imgUrl}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-contain"
                                    onError={(e) => showOriginalOrPlaceholder(e, rawImgUrl)}
                                  />
                                </div>
                                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-ink group-hover/cat:text-brand transition-colors text-center line-clamp-2 max-w-[125px]">
                                  {sub.name}
                                </span>
                              </Link>
                            );
                          })}
                        </div>

                        {/* Bottom Feature Bar */}
                        <div className="border-t border-slate-100 mt-6 sm:mt-8 pt-4 sm:pt-5 flex flex-wrap items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-bold uppercase tracking-wider">
                            <Link
                              to={`/categories/${item.slug}`}
                              onClick={closeMenus}
                              className="text-brand hover:underline inline-flex items-center gap-1.5"
                            >
                              <span>Xem tất cả {item.name}</span>
                              <ArrowRight size={14} />
                            </Link>
                            <Link
                              to="/products?sort=newest"
                              onClick={closeMenus}
                              className="text-slate-600 hover:text-brand inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Sparkles size={14} className="text-amber-500" />
                              <span>Hàng mới về</span>
                            </Link>
                            <Link
                              to="/products?filter=sale"
                              onClick={closeMenus}
                              className="text-slate-600 hover:text-brand inline-flex items-center gap-1.5 transition-colors"
                            >
                              <BadgePercent size={14} className="text-brand" />
                              <span>Ưu đãi có hạn</span>
                            </Link>
                            <Link
                              to="/products"
                              onClick={closeMenus}
                              className="text-slate-600 hover:text-brand inline-flex items-center gap-1.5 transition-colors"
                            >
                              <span>Tất cả sản phẩm</span>
                            </Link>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Bộ sưu tập Atino chính hãng
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Tất cả sản phẩm Link */}
            <NavLink
              className={({ isActive }) =>
                `header-nav-link ${isActive ? 'active nav-hovered' : ''}`
              }
              to="/products"
              onClick={closeMenus}
              onMouseEnter={() => handleCategoryHover(null, 0)}
            >
              {({ isActive }) => (
                <span className="relative py-0.5">
                  TẤT CẢ SẢN PHẨM
                  {isActive && <span className="nav-link-underline" />}
                </span>
              )}
            </NavLink>

            {/* Mobile-only drawer footer links */}
            <div className="lg:hidden border-t border-slate-200 pt-3 mt-2 flex flex-col gap-1">
              <NavLink
                to="/"
                end
                onClick={closeMenus}
                className="header-nav-link"
              >
                TRANG CHỦ
              </NavLink>
              <Link
                to="/ai-assistant"
                onClick={closeMenus}
                className="header-nav-link text-brand font-bold flex items-center gap-1.5"
              >
                <Sparkles size={15} />
                TRỢ LÝ MUA SẮM AI
              </Link>
              {user?.role === 'ADMIN' && (
                <NavLink to="/admin" className="header-nav-link text-blue-700" onClick={closeMenus}>
                  QUẢN TRỊ
                </NavLink>
              )}
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    logout();
                    navigate('/');
                  }}
                  className="header-nav-link text-red-600 text-left font-bold"
                >
                  Đăng xuất ({user.fullName})
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-2">
                  <Link
                    to="/login"
                    onClick={closeMenus}
                    className="btn-primary text-center py-2 text-xs"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    onClick={closeMenus}
                    className="btn-outline text-center py-2 text-xs"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Center/Right: Desktop Pill Search Box */}
        {searchForm(false)}

        {/* Right: Header Action Icons */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* AI Assistant Pill Link */}
          <Link
            to="/ai-assistant"
            onClick={closeMenus}
            className={`hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-colors mr-1 ${
              isTransparent
                ? 'text-white bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-sm'
                : 'text-brand bg-red-50 hover:bg-red-100 border border-red-200'
            }`}
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>Trợ lý AI</span>
          </Link>

          {/* Notifications */}
          <NotificationBell />

          {/* Wishlist */}
          <Link
            aria-label="Yêu thích"
            title="Danh sách yêu thích"
            to="/wishlist"
            onClick={closeMenus}
            className={`header-icon-button ${isTransparent ? 'text-white hover:bg-white/15' : 'text-ink'}`}
          >
            <Heart size={20} strokeWidth={1.8} />
            {wishlistCount > 0 && <span className="cart-count">{wishlistCount}</span>}
          </Link>

          {/* Member / User Account */}
          <div ref={userMenuRef} className="relative">
            <button
              type="button"
              aria-label="Tài khoản"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`header-icon-button gap-1 ${isTransparent ? 'text-white hover:bg-white/15' : 'text-ink'}`}
            >
              <UserRound size={20} strokeWidth={1.8} />
              <span className={`hidden 2xl:inline text-xs font-bold uppercase tracking-wider ${isTransparent ? 'text-white' : 'text-ink'}`}>
                {user ? user.fullName.split(' ').at(-1) : 'Hội viên'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#ccc] shadow-xl p-3 z-50 text-left animate-fade-in text-ink">
                {user ? (
                  <>
                    <div className="pb-2 mb-2 border-b border-[#eee]">
                      <div className="text-[11px] text-[#767676]">Đã đăng nhập</div>
                      <div className="text-sm font-bold text-ink truncate">{user.fullName}</div>
                    </div>
                    <Link
                      to="/account/profile"
                      onClick={closeMenus}
                      className="block py-1.5 text-xs font-bold uppercase hover:text-brand"
                    >
                      Thông tin tài khoản
                    </Link>
                    <Link
                      to="/account/orders"
                      onClick={closeMenus}
                      className="block py-1.5 text-xs font-bold uppercase hover:text-brand"
                    >
                      Đơn hàng của tôi
                    </Link>
                    <Link
                      to="/account/addresses"
                      onClick={closeMenus}
                      className="block py-1.5 text-xs font-bold uppercase hover:text-brand"
                    >
                      Sổ địa chỉ
                    </Link>
                    {user.role === 'ADMIN' && (
                      <Link
                        to="/admin"
                        onClick={closeMenus}
                        className="block py-1.5 text-xs font-bold uppercase text-brand"
                      >
                        Quản trị hệ thống
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        closeMenus();
                        logout();
                        navigate('/');
                      }}
                      className="block w-full text-left py-2 mt-2 border-t border-[#eee] text-xs font-bold uppercase text-red-600 hover:underline"
                    >
                      Đăng xuất
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-[#666] mb-3">
                      Đăng nhập để nhận ưu đãi thành viên và theo dõi đơn hàng.
                    </div>
                    <Link
                      to="/login"
                      onClick={closeMenus}
                      className="btn-primary w-full text-center py-2 text-xs mb-2"
                    >
                      ĐĂNG NHẬP
                    </Link>
                    <Link
                      to="/register"
                      onClick={closeMenus}
                      className="btn-outline w-full text-center py-2 text-xs"
                    >
                      TẠO TÀI KHOẢN
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cart Bag */}
          <Link
            aria-label="Giỏ hàng"
            to="/cart"
            onClick={closeMenus}
            data-cart-target
            className={`header-icon-button ${isTransparent ? 'text-white hover:bg-white/15' : 'text-ink'}`}
          >
            <ShoppingBag
              key={count}
              size={20}
              strokeWidth={1.8}
              className={count ? 'cart-pop' : ''}
            />
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#f8f8f8] text-ink border-t border-[#e5e5e5] mt-20">
      {/* Newsletter Strip */}
      <div className="bg-ink text-white py-8 border-b border-white/10">
        <div className="container-shell flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">
              ĐĂNG KÝ NHẬN BẢN TIN FASHIONHUB
            </h3>
            <p className="text-xs text-[#aaa] mt-1">
              Nhận ngay mã giảm giá 100.000₫ cho đơn hàng đầu tiên và thông tin ưu đãi sớm nhất.
            </p>
          </div>
          <div className="flex w-full md:w-auto max-w-md">
            <input
              type="email"
              placeholder="Nhập địa chỉ email của bạn..."
              className="bg-white text-ink text-xs px-4 py-3 outline-none flex-1 min-w-0"
            />
            <button className="bg-brand text-white text-xs font-bold uppercase tracking-wider px-6 py-3 hover:bg-[#b8000e] transition-colors shrink-0">
              ĐĂNG KÝ
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Links Columns */}
      <div className="container-shell grid grid-cols-2 md:grid-cols-4 gap-8 py-14 text-xs">
        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-ink mb-4 pb-1 border-b border-[#ddd]">
            VỀ FASHIONHUB
          </h4>
          <ul className="space-y-2.5 text-[#555]">
            <li>
              <Link to="/about" className="hover:text-brand transition-colors">
                Thông tin thương hiệu
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-brand transition-colors">
                Triết lý thời trang
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-brand transition-colors">
                Phát triển bền vững
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-ink mb-4 pb-1 border-b border-[#ddd]">
            TRỢ GIÚP & HỖ TRỢ
          </h4>
          <ul className="space-y-2.5 text-[#555]">
            <li>
              <Link to="/policies/shipping" className="hover:text-brand transition-colors">
                Chính sách giao hàng
              </Link>
            </li>
            <li>
              <Link to="/policies/returns" className="hover:text-brand transition-colors">
                Chính sách đổi trả 7 ngày
              </Link>
            </li>
            <li>
              <Link to="/size-guide" className="hover:text-brand transition-colors">
                Hướng dẫn chọn size
              </Link>
            </li>
            <li>
              <Link to="/policies/privacy" className="hover:text-brand transition-colors">
                Chính sách bảo mật
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-brand transition-colors">
                Liên hệ hỗ trợ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-ink mb-4 pb-1 border-b border-[#ddd]">
            TÀI KHOẢN & HỘI VIÊN
          </h4>
          <ul className="space-y-2.5 text-[#555]">
            <li>
              <Link to="/account/profile" className="hover:text-brand transition-colors">
                Thông tin tài khoản
              </Link>
            </li>
            <li>
              <Link to="/account/orders" className="hover:text-brand transition-colors">
                Lịch sử đơn hàng
              </Link>
            </li>
            <li>
              <Link to="/wishlist" className="hover:text-brand transition-colors">
                Danh sách yêu thích
              </Link>
            </li>
            <li>
              <Link to="/account/addresses" className="hover:text-brand transition-colors">
                Sổ địa chỉ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-ink mb-4 pb-1 border-b border-[#ddd]">
            TRỢ LÝ MUA SẮM AI
          </h4>
          <p className="text-[#666] leading-relaxed mb-3">
            Cần gợi ý trang phục hoặc tư vấn phối đồ? Trợ lý AI FashionHub luôn sẵn sàng hỗ trợ 24/7.
          </p>
          <Link to="/ai-assistant" className="btn-secondary w-full py-2.5 text-center block">
            TRÒ CHUYỆN VỚI AI →
          </Link>
        </div>
      </div>

      {/* Bottom Copyright Bar */}
      <div className="border-t border-[#e5e5e5] py-5 text-[11px] text-[#767676]">
        <div className="container-shell flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>© 2026 FashionHub Co., Ltd. Bảo lưu mọi quyền.</span>
          <div className="flex gap-4">
            <Link to="/policies/terms" className="hover:underline">
              Điều khoản sử dụng
            </Link>
            <Link to="/policies/privacy" className="hover:underline">
              Chính sách quyền riêng tư
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function MainLayout() {
  const location = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [loading, setLoading] = useState(false);

  // Trigger top slim loading bar on route change
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  // Back to top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="shopfront min-h-screen flex flex-col bg-white">
      {/* Top red progress loading bar */}
      {loading && <div className="top-loading-bar" />}

      <Header />

      {/* Main content with page transition */}
      <main
        key={location.pathname}
        className={`flex-1 page-transition ${location.pathname === '/' ? '' : 'pt-20 sm:pt-24'}`}
      >
        <Outlet />
      </main>

      <Footer />

      {/* Floating Back-to-Top Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Cuộn lên đầu trang"
          title="Cuộn lên đầu trang"
          className="back-to-top"
        >
          <ArrowUp size={20} strokeWidth={2.2} />
        </button>
      )}

      <ChatWidget />
      <NotificationToast />
    </div>
  );
}

const adminLinks = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Sản phẩm', icon: Package },
  { to: '/admin/promotions', label: 'Giảm giá', icon: BadgePercent },
  { to: '/admin/loyalty', label: 'Thành viên & ưu đãi', icon: Star },
  { to: '/admin/categories', label: 'Danh mục', icon: Tags },
  { to: '/admin/home-categories', label: 'Danh mục trang chủ', icon: Layers },
  { to: '/admin/banners', label: 'Banner trang chủ', icon: Tags },
  { to: '/admin/inventory', label: 'Tồn kho', icon: Boxes },
  { to: '/admin/orders', label: 'Đơn hàng', icon: ClipboardList },
  { to: '/admin/reviews', label: 'Đánh giá', icon: Star },
  { to: '/admin/knowledge', label: 'Nội dung trợ lý', icon: Bot },
  { to: '/admin/ai-conversations', label: 'Hội thoại', icon: Bot },
  { to: '/admin/reports', label: 'Thống kê', icon: BarChart3 },
];

export function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  return (
    <div className="min-h-screen bg-[#f7f7f8] lg:flex">
      <aside className="bg-ink text-white lg:w-64 shrink-0 p-5">
        <Link to="/" className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-brand text-white flex flex-col items-center justify-center font-black text-[11px] leading-tight">
            <span>FH</span>
          </div>
          <span className="text-lg font-black tracking-tight ml-1">FASHIONHUB</span>
        </Link>
        <p className="text-[#888] text-[11px] uppercase tracking-wider mb-8">Hệ thống quản lý</p>
        <nav className="flex lg:flex-col gap-1 overflow-x-auto">
          {adminLinks.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `admin-nav ${isActive ? 'admin-nav-active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block mt-12 border-t border-white/10 pt-5 text-sm">
          <p className="text-slate-300 mb-4">{user?.fullName}</p>
          <Link to="/" className="flex gap-2 items-center text-slate-300 hover:text-white mb-4">
            <ShoppingBag size={17} />
            Xem cửa hàng
          </Link>
          <button
            onClick={logout}
            className="flex gap-2 items-center text-slate-300 hover:text-white"
          >
            <LogOut size={17} />
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="bg-white border-b px-5 lg:px-8 py-4 flex justify-between items-center">
          <span className="font-semibold text-sm uppercase tracking-wider text-ink">Bảng điều khiển</span>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link to="/" className="text-xs font-bold uppercase text-brand hover:underline">
              Về cửa hàng ↗
            </Link>
          </div>
        </div>
        <main className="p-5 lg:p-8 max-w-[1440px] mx-auto">
          <Outlet />
        </main>
        <NotificationToast />
      </div>
    </div>
  );
}
