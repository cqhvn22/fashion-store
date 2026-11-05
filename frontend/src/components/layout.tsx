import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Boxes,
  ClipboardList,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Tags,
  UserRound,
  X,
} from 'lucide-react';
import { categoryService } from '../services/catalog';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import { ChatWidget } from '../features/chat/ChatWidget';
import { mockMode } from '../services/httpClient';
export function Header() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: categoryService.list,
  });
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const count = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="bg-ink text-white text-xs py-1.5 text-center">
        Miễn phí vận chuyển cho đơn từ 500.000₫ · Đổi size trong 7 ngày{' '}
        {mockMode && <span className="ml-2 text-amber-300">· Chế độ demo</span>}
      </div>
      <div className="container-shell flex items-center gap-4 lg:gap-8 py-4">
        <button className="lg:hidden" aria-label="Mở menu" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <Link to="/" className="text-2xl font-black tracking-tight shrink-0">
          fashion<span className="text-brand">hub.</span>
        </Link>
        <form
          className="search-box flex-1 hidden sm:flex"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(`/search?q=${encodeURIComponent(term.trim())}`);
          }}
        >
          <input
            aria-label="Tìm kiếm sản phẩm"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Bạn đang tìm gì hôm nay?"
            className="min-w-0 flex-1 outline-none bg-transparent text-sm"
          />
          <button className="search-submit" aria-label="Tìm kiếm" title="Tìm kiếm">
            <Search size={19} strokeWidth={2.2} />
          </button>
        </form>
        <div className="ml-auto flex items-center gap-4 md:gap-6">
          <Link aria-label="Yêu thích" to="/wishlist" className="hidden sm:block hover:text-brand">
            <Heart size={22} />
          </Link>
          <Link
            aria-label="Tài khoản"
            to={user ? '/account/profile' : '/login'}
            className="flex items-center gap-2 hover:text-brand"
          >
            <UserRound size={22} />
            <span className="hidden md:inline text-sm">
              {user ? user.fullName.split(' ').at(-1) : 'Đăng nhập'}
            </span>
          </Link>
          <Link
            aria-label="Giỏ hàng"
            to="/cart"
            data-cart-target
            className="relative header-icon-link"
          >
            <ShoppingBag key={count} size={23} className={count ? 'cart-pop' : ''} />
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
        </div>
      </div>
      <nav className={`${open ? 'block' : 'hidden'} lg:block border-t border-slate-100`}>
        <div className="container-shell flex flex-wrap gap-5 lg:gap-8 py-3 text-sm font-medium">
          <NavLink className="header-nav-link" to="/products" onClick={() => setOpen(false)}>
            Tất cả sản phẩm
          </NavLink>
          {categories
            .filter((item) => item.isActive)
            .map((item) => (
              <NavLink
                className="header-nav-link"
                key={item.id}
                to={`/categories/${item.slug}`}
                onClick={() => setOpen(false)}
              >
                {item.name}
              </NavLink>
            ))}
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" className="header-nav-link" onClick={() => setOpen(false)}>
              Quản trị
            </NavLink>
          )}
          {user && (
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="lg:hidden"
            >
              Đăng xuất
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="bg-ink text-white mt-16">
      <div className="container-shell grid md:grid-cols-4 gap-8 py-12 text-sm">
        <div>
          <div className="text-2xl font-black mb-3">
            fashion<span className="text-[#ff795f]">hub.</span>
          </div>
          <p className="text-slate-300 leading-6">
            Trang phục dễ mặc, dễ yêu. Mỗi ngày là một dịp để bạn là chính mình.
          </p>
        </div>
        <div>
          <h3 className="font-bold mb-4">Khám phá</h3>
          <div className="footer-links">
            <Link to="/products">Sản phẩm</Link>
            <Link to="/about">Về FashionHub</Link>
            <Link to="/size-guide">Hướng dẫn chọn size</Link>
          </div>
        </div>
        <div>
          <h3 className="font-bold mb-4">Hỗ trợ</h3>
          <div className="footer-links">
            <Link to="/contact">Liên hệ</Link>
            <Link to="/policies/shipping">Giao hàng</Link>
            <Link to="/policies/returns">Đổi trả</Link>
            <Link to="/policies/privacy">Bảo mật</Link>
          </div>
        </div>
        <div>
          <h3 className="font-bold mb-4">Cần tư vấn?</h3>
          <p className="text-slate-300 mb-3">Trợ lý mua sắm luôn sẵn sàng giúp bạn.</p>
          <Link to="/ai-assistant" className="text-[#ff795f] font-semibold">
            Trò chuyện ngay →
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10 text-slate-400 text-xs text-center py-4">
        © 2026 FashionHub · Dữ liệu demo phục vụ đồ án.
      </div>
    </footer>
  );
}
export function MainLayout() {
  return (
    <>
      <Header />
      <main className="min-h-[60vh]">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </>
  );
}
const adminLinks = [
  { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Sản phẩm', icon: Package },
  { to: '/admin/categories', label: 'Danh mục', icon: Tags },
  { to: '/admin/inventory', label: 'Tồn kho', icon: Boxes },
  { to: '/admin/orders', label: 'Đơn hàng', icon: ClipboardList },
  { to: '/admin/knowledge', label: 'Kho tri thức AI', icon: Bot },
  { to: '/admin/ai-conversations', label: 'Hội thoại AI', icon: Bot },
  { to: '/admin/reports', label: 'Thống kê', icon: BarChart3 },
];
export function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  return (
    <div className="min-h-screen bg-[#f7f7f8] lg:flex">
      <aside className="bg-ink text-white lg:w-64 shrink-0 p-5">
        <Link to="/" className="text-2xl font-black">
          fashion<span className="text-[#ff795f]">hub.</span>
        </Link>
        <p className="text-slate-400 text-xs uppercase tracking-wider mt-1 mb-8">Admin workspace</p>
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
        <div className="bg-white border-b px-5 lg:px-8 py-4 flex justify-between">
          <span className="font-semibold">Bảng điều khiển</span>
          <Link to="/" className="text-sm text-brand">
            Về cửa hàng ↗
          </Link>
        </div>
        <main className="p-5 lg:p-8 max-w-[1440px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
