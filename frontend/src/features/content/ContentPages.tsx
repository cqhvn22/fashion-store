import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  RotateCcw,
  Truck,
  ShieldCheck,
  Ruler,
  Info,
  PhoneCall,
  CheckCircle2,
  ChevronRight,
  Mail,
  MapPin,
  Clock,
  Search,
  ExternalLink,
  Navigation,
} from 'lucide-react';
import { storesList } from '../../data/storesData';

export type ContentPageName =
  | 'terms'
  | 'returns'
  | 'shipping'
  | 'privacy'
  | 'size-guide'
  | 'about'
  | 'contact'
  | 'stores';

interface PolicyNavItem {
  id: ContentPageName;
  path: string;
  label: string;
  shortLabel: string;
  icon: typeof FileText;
}

const policyNavItems: PolicyNavItem[] = [
  {
    id: 'stores',
    path: '/stores',
    label: 'Hệ thống cửa hàng',
    shortLabel: 'Cửa hàng',
    icon: MapPin,
  },
  {
    id: 'terms',
    path: '/policies/terms',
    label: 'Điều khoản sử dụng',
    shortLabel: 'Điều khoản',
    icon: FileText,
  },
  {
    id: 'returns',
    path: '/policies/returns',
    label: 'Chính sách đổi trả 7 ngày',
    shortLabel: 'Đổi trả',
    icon: RotateCcw,
  },
  {
    id: 'shipping',
    path: '/policies/shipping',
    label: 'Chính sách giao hàng',
    shortLabel: 'Giao hàng',
    icon: Truck,
  },
  {
    id: 'privacy',
    path: '/policies/privacy',
    label: 'Chính sách bảo mật',
    shortLabel: 'Bảo mật',
    icon: ShieldCheck,
  },
  {
    id: 'size-guide',
    path: '/size-guide',
    label: 'Hướng dẫn chọn size',
    shortLabel: 'Bảng size',
    icon: Ruler,
  },
  {
    id: 'about',
    path: '/about',
    label: 'Về FashionHub',
    shortLabel: 'Về chúng tôi',
    icon: Info,
  },
  {
    id: 'contact',
    path: '/contact',
    label: 'Liên hệ hỗ trợ',
    shortLabel: 'Liên hệ',
    icon: PhoneCall,
  },
];

export function ContentPage({ name }: { name: ContentPageName }) {
  const currentItem = policyNavItems.find((p) => p.id === name);

  return (
    <div className="bg-white min-h-screen py-8 md:py-10 border-t border-[#e5e5e5]">
      <div className="container-shell">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-[#767676]">
          <Link to="/" className="hover:text-ink transition-colors">
            Trang chủ
          </Link>
          <ChevronRight size={13} className="text-[#aaa]" />
          <span className="text-[#767676]">Chính sách & Hỗ trợ</span>
          <ChevronRight size={13} className="text-[#aaa]" />
          <span className="font-semibold text-ink">
            {currentItem?.label}
          </span>
        </nav>

        {/* Quick Horizontal Scroll Nav for Mobile/Tablet */}
        <div className="lg:hidden mb-6 overflow-x-auto pb-2 scrollbar-none flex items-center gap-2">
          {policyNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === name;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors border ${
                  active
                    ? 'bg-ink text-white border-ink'
                    : 'bg-[#f4f4f4] text-ink border-[#e5e5e5] hover:bg-slate-200'
                }`}
              >
                <Icon size={14} />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Desktop Sidebar Navigation */}
          <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#e5e5e5] sticky top-24">
            <div className="p-4 border-b border-[#eee]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">
                CHÍNH SÁCH & HỖ TRỢ
              </div>
            </div>
            <ul className="divide-y divide-[#f2f2f2]">
              {policyNavItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === name;
                return (
                  <li key={item.id}>
                    <Link
                      to={item.path}
                      className={`flex items-center justify-between px-4 py-3 text-xs transition-colors ${
                        active
                          ? 'border-l-4 border-brand bg-[#f7f7f8] font-bold text-ink'
                          : 'text-[#555] hover:text-ink hover:bg-[#fafafa] font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={15} className={active ? 'text-brand' : 'text-[#888]'} />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Quick Hotline in Sidebar */}
            <div className="p-4 border-t border-[#eee] bg-[#fafafa] text-xs space-y-1.5">
              <div className="font-bold text-ink flex items-center gap-1.5">
                <PhoneCall size={14} className="text-brand" />
                <span>Hỗ trợ khách hàng</span>
              </div>
              <div className="text-base font-extrabold text-brand tracking-tight">1800 6000</div>
              <div className="text-[11px] text-[#767676]">Miễn phí cuộc gọi · 8:00 – 21:30</div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-9 bg-white border border-[#e5e5e5] p-6 sm:p-8 md:p-10">
            {renderPolicyContent(name)}
          </main>
        </div>
      </div>
    </div>
  );
}

function renderPolicyContent(name: ContentPageName) {
  switch (name) {
    case 'stores':
      return <StoresContent />;
    case 'terms':
      return <TermsContent />;
    case 'returns':
      return <ReturnsContent />;
    case 'shipping':
      return <ShippingContent />;
    case 'privacy':
      return <PrivacyContent />;
    case 'size-guide':
      return <SizeGuideContent />;
    case 'about':
      return <AboutContent />;
    case 'contact':
      return <ContactContent />;
    default:
      return null;
  }
}

/* =========================================================================
   1. HỆ THỐNG CỬA HÀNG (STORE LOCATOR VỚI GOOGLE MAPS)
   ========================================================================= */
function StoresContent() {
  const [selectedCity, setSelectedCity] = useState<'Tất cả' | 'Hà Nội' | 'TP. Hồ Chí Minh' | 'Đà Nẵng'>('Tất cả');
  const [search, setSearch] = useState('');
  const [activeStoreId, setActiveStoreId] = useState(storesList[0].id);

  const filtered = storesList.filter((s) => {
    const matchCity = selectedCity === 'Tất cả' || s.city === selectedCity;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q) ||
      s.district.toLowerCase().includes(q);
    return matchCity && matchSearch;
  });

  const activeStore = filtered.find((s) => s.id === activeStoreId) || filtered[0] || storesList[0];

  const cities: ('Tất cả' | 'Hà Nội' | 'TP. Hồ Chí Minh' | 'Đà Nẵng')[] = [
    'Tất cả',
    'Hà Nội',
    'TP. Hồ Chí Minh',
    'Đà Nẵng',
  ];

  return (
    <article className="space-y-6 text-sm text-[#444]">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">
          FASHIONHUB · HỆ THỐNG CỬA HÀNG
        </span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Hệ Thống Cửa Hàng FashionHub Toàn Quốc
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Trải nghiệm trực tiếp chất lượng vải, phom dáng và dịch vụ may đo, đổi trả tại 10 điểm bán trên toàn quốc.
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#eee]">
        {/* City Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {cities.map((city) => {
            const count = city === 'Tất cả' ? storesList.length : storesList.filter((s) => s.city === city).length;
            const isActive = selectedCity === city;
            return (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                aria-label={`Lọc theo ${city}`}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap border ${
                  isActive
                    ? 'bg-ink text-white border-ink'
                    : 'bg-[#f4f4f4] text-[#555] border-[#e5e5e5] hover:bg-slate-200 hover:text-ink'
                }`}
              >
                {city} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Store input */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên hoặc đường..."
            aria-label="Tìm kiếm cửa hàng"
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#ccc] bg-white text-ink placeholder:text-[#999] focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      {/* Main Stores & Google Map Grid */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left List of Stores */}
        <div className="lg:col-span-5 space-y-2.5 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="p-8 text-center border border-[#eee] text-xs text-[#888]">
              Không tìm thấy cửa hàng phù hợp với từ khóa "{search}".
            </div>
          ) : (
            filtered.map((store) => {
              const isSelected = store.id === activeStore.id;
              return (
                <div
                  key={store.id}
                  onClick={() => setActiveStoreId(store.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveStoreId(store.id);
                    }
                  }}
                  className={`p-3.5 border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-l-4 border-l-brand border-[#ccc] bg-[#fafafa]'
                      : 'border-[#eee] hover:border-[#ccc] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className={`text-xs font-bold uppercase tracking-wide ${isSelected ? 'text-brand' : 'text-ink'}`}>
                      {store.name}
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-[#f0f0f0] text-[#555] whitespace-nowrap">
                      {store.tag}
                    </span>
                  </div>

                  <p className="text-xs text-[#555] flex items-start gap-1.5 mt-1.5 leading-snug">
                    <MapPin size={13} className="text-brand shrink-0 mt-0.5" />
                    <span>{store.address}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-[#777]">
                    <span className="flex items-center gap-1">
                      <PhoneCall size={12} /> {store.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {store.hours}
                    </span>
                  </div>

                  {/* Services pills */}
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {store.services.slice(0, 3).map((srv) => (
                      <span key={srv} className="text-[10px] bg-[#f0f0f0] text-[#666] px-1.5 py-0.5">
                        {srv}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#f0f0f0] flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Đang mở cửa
                    </span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${store.name} ${store.address}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand hover:underline inline-flex items-center gap-1 font-semibold text-[11px]"
                    >
                      <span>Mở Google Maps</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Google Maps Embed */}
        <div className="lg:col-span-7 border border-[#e5e5e5] bg-[#f8f8f8] flex flex-col h-[480px] lg:h-[640px] sticky top-28 overflow-hidden">
          {/* Active store info header */}
          <div className="p-3 bg-white border-b border-[#eee] flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <strong className="block text-ink uppercase tracking-wide truncate">
                {activeStore.name}
              </strong>
              <span className="text-[11px] text-[#767676] truncate block">
                {activeStore.address}
              </span>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${activeStore.name} ${activeStore.address}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-ink text-white hover:bg-brand text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              <span>Chỉ đường</span>
              <Navigation size={12} />
            </a>
          </div>

          {/* Interactive Google Map Iframe */}
          <div className="flex-1 w-full h-full relative">
            <iframe
              key={activeStore.id}
              title={`Bản đồ vị trí ${activeStore.name}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(
                activeStore.mapQuery
              )}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/* =========================================================================
   2. ĐIỀU KHOẢN DỊCH VỤ & SỬ DỤNG WEBSITE (TERMS OF SERVICE)
   ========================================================================= */
function TermsContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">FASHIONHUB · ĐIỀU KHOẢN</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Điều Khoản Dịch Vụ & Sử Dụng Website
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Cập nhật lần cuối: Tháng 11/2026 · Áp dụng cho mọi giao dịch trên nền tảng FashionHub
        </p>
      </div>

      <div className="bg-[#f7f7f8] border-l-2 border-ink p-4 text-xs text-[#555] leading-relaxed">
        <strong className="text-ink font-bold">Lưu ý quan trọng:</strong> Bằng việc truy cập, tạo tài khoản hoặc đặt mua hàng tại website{' '}
        <strong className="text-ink">fashionhub.vn</strong>, quý khách xác nhận đã đủ tuổi năng lực hành vi dân sự, đã đọc kỹ, hiểu rõ và
        tự nguyện đồng ý tuân thủ toàn bộ các điều khoản được quy định dưới đây.
      </div>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          1. Quy định về tài khoản người dùng
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-xs text-[#555]">
          <li>
            Khách hàng từ đủ 15 tuổi trở lên có quyền tự đăng ký tài khoản thành viên. Người chưa đủ 15 tuổi cần có sự
            hướng dẫn và đồng ý của phụ huynh hoặc người đại diện theo pháp luật.
          </li>
          <li>
            Quý khách có trách nhiệm cung cấp thông tin chính xác, đầy đủ và cập nhật (họ tên, số điện thoại, địa chỉ nhận
            hàng) để đảm bảo quyền lợi khi giao nhận và bảo hành.
          </li>
          <li>
            Quý khách chịu hoàn toàn trách nhiệm bảo mật mật khẩu tài khoản cá nhân. FashionHub không chịu trách nhiệm đối
            với các thiệt hại phát sinh do quý khách để lộ thông tin đăng nhập cho bên thứ ba.
          </li>
          <li>
            FashionHub có quyền tạm khóa hoặc đóng vĩnh viễn tài khoản nếu phát hiện hành vi gian lận mã giảm giá, sử dụng
            phần mềm can thiệp trái phép, hoặc vi phạm pháp luật hiện hành.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          2. Giá cả, thông tin sản phẩm và chương trình khuyến mãi
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-xs text-[#555]">
          <li>
            Toàn bộ giá niêm yết trên website được tính bằng <strong>Việt Nam Đồng (VNĐ)</strong> và đã bao gồm thuế giá trị gia
            tăng (VAT) theo quy định của pháp luật Việt Nam. Phí vận chuyển (nếu có) sẽ được hiển thị rõ ràng tại bước thanh
            toán.
          </li>
          <li>
            Hình ảnh sản phẩm được chụp từ mẫu thực tế. Tuy nhiên màu sắc có thể chênh lệch nhẹ (khoảng 3–5%) do điều kiện
            ánh sáng màn hình hoặc thiết bị hiển thị của quý khách.
          </li>
          <li>
            Trường hợp xảy ra lỗi kỹ thuật hiển thị sai giá bất thường (ví dụ: giá hiển thị 0đ hoặc sai lệch lớn do sự cố máy
            chủ), FashionHub có quyền liên hệ với khách hàng để điều chỉnh hoặc hủy đơn hàng và hoàn tiền 100% nếu quý khách
            đã thanh toán trước.
          </li>
          <li>
            Mỗi mã ưu đãi, voucher chào mừng chỉ áp dụng 1 lần cho mỗi khách hàng/đơn hàng hợp lệ và không thể quy đổi thành
            tiền mặt.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          3. Xác lập đơn hàng và hợp đồng mua bán
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-xs text-[#555]">
          <li>
            Khi quý khách bấm nút <strong>"Đặt hàng"</strong>, thao tác này được xem là một đề nghị giao kết hợp đồng mua bán.
          </li>
          <li>
            Hợp đồng mua bán chỉ chính thức được xác lập khi FashionHub gửi thông báo xác nhận đơn hàng thành công kèm mã
            đơn hàng điện tử qua Email, tin nhắn hoặc trên giao diện hệ thống.
          </li>
          <li>
            FashionHub có quyền từ chối phục vụ hoặc hủy đơn trong các trường hợp: địa chỉ giao hàng không đầy đủ, không liên
            lạc được với người nhận sau 3 lần gọi, hoặc phát hiện đơn hàng có dấu hiệu đầu cơ, gom hàng số lượng lớn trái quy
            định.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          4. Phương thức thanh toán hợp lệ
        </h2>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 border border-[#e5e5e5] bg-[#fafafa]">
            <div className="font-bold text-ink mb-1">1. Thanh toán khi nhận hàng (COD)</div>
            <p className="text-[#555]">
              Quý khách thanh toán tiền mặt trực tiếp cho nhân viên giao hàng sau khi kiểm tra đúng số lượng và gói hàng.
            </p>
          </div>
          <div className="p-3.5 border border-[#e5e5e5] bg-[#fafafa]">
            <div className="font-bold text-ink mb-1">2. Chuyển khoản QR qua PayOS</div>
            <p className="text-[#555]">
              Quét mã VietQR nhanh chóng qua ứng dụng mọi ngân hàng hoặc ví điện tử, hệ thống xác nhận thanh toán tức thì.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          5. Quyền sở hữu trí tuệ
        </h2>
        <p className="text-xs text-[#555]">
          Toàn bộ thương hiệu <strong>FashionHub</strong>, logo, biểu tượng, hình ảnh chụp độc quyền, video clip, văn bản mô tả,
          thiết kế đồ họa và mã nguồn đều thuộc quyền sở hữu của Công ty TNHH Thời Trang FashionHub Việt Nam. Nghiêm cấm mọi hành
          vi sao chép, trích xuất hoặc tái sử dụng vì mục đích thương mại khi chưa có văn bản đồng ý chính thức.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          6. Luật điều chỉnh và giải quyết tranh chấp
        </h2>
        <p className="text-xs text-[#555]">
          Điều khoản này được điều chỉnh và giải thích theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam. Mọi bất đồng hoặc
          tranh chấp phát sinh trước hết sẽ được ưu tiên giải quyết thông qua thương lượng và hòa giải trên tinh thần tôn trọng
          quyền lợi người tiêu dùng. Trường hợp không thể thương lượng, vụ việc sẽ được đưa ra Tòa án nhân dân có thẩm quyền tại
          TP. Hồ Chí Minh để giải quyết.
        </p>
      </section>
    </article>
  );
}

/* =========================================================================
   3. CHÍNH SÁCH ĐỔI TRẢ & HOÀN TIỀN (RETURN & REFUND POLICY)
   ========================================================================= */
function ReturnsContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">CAM KẾT HẬU MÃI</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Chính Sách Đổi Trả & Hoàn Tiền Trong 7 Ngày
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Chính sách hỗ trợ đổi size, đổi màu linh hoạt nhằm đem đến trải nghiệm mua sắm an tâm tuyệt đối
        </p>
      </div>

      {/* 3 Core Highlight Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 text-center">
          <div className="text-2xl font-black text-ink">07 NGÀY</div>
          <div className="text-xs font-bold text-ink mt-1">Thời gian đổi hàng</div>
          <p className="text-[11px] text-[#767676] mt-1">Tính từ thời điểm ký nhận bưu phẩm</p>
        </div>
        <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 text-center">
          <div className="text-2xl font-black text-brand">100% FREE</div>
          <div className="text-xs font-bold text-ink mt-1">Miễn phí đổi hàng lỗi</div>
          <p className="text-[11px] text-[#767676] mt-1">FashionHub chịu phí ship 2 chiều</p>
        </div>
        <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 text-center">
          <div className="text-2xl font-black text-ink">TOÀN QUỐC</div>
          <div className="text-xs font-bold text-ink mt-1">Đổi tại cửa hàng & online</div>
          <p className="text-[11px] text-[#767676] mt-1">Tại bất kỳ cửa hàng nào hoặc bưu điện</p>
        </div>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          1. Điều kiện sản phẩm được đổi trả hợp lệ
        </h2>
        <div className="bg-[#fafafa] border border-[#e5e5e5] p-4 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Sản phẩm còn <strong>nguyên tem mác (tag giấy), nhãn dệt phụ liệu</strong> và hóa đơn / phiếu đóng gói đính kèm.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Sản phẩm <strong>chưa qua giặt ủi, chưa qua sử dụng</strong>, không có vết bẩn, không bị rách xước do tác động bên ngoài.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Không bị ám mùi lạ như nước hoa, chất khử mùi cơ thể, khói thuốc lá hoặc hóa chất giặt tẩy.
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          2. Phân loại trường hợp đổi trả & Chi phí vận chuyển
        </h2>
        <div className="overflow-x-auto border border-[#e5e5e5]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f4f4f4] text-ink font-bold border-b border-[#e5e5e5]">
              <tr>
                <th className="p-3">Trường hợp</th>
                <th className="p-3">Giải pháp hỗ trợ</th>
                <th className="p-3">Phí vận chuyển</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee] text-[#555]">
              <tr>
                <td className="p-3 font-semibold text-ink">Lỗi từ nhà sản xuất (rách chỉ, hư khóa, sai mô tả)</td>
                <td className="p-3">Đổi mới sản phẩm hoặc hoàn tiền 100%</td>
                <td className="p-3 font-bold text-brand">FashionHub chi trả 100% hai chiều</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-ink">Khách hàng muốn đổi size (chật/rộng)</td>
                <td className="p-3">Hỗ trợ đổi sang size vừa vặn</td>
                <td className="p-3">Miễn phí tại cửa hàng; khách chịu 1 chiều ship nếu gửi bưu điện</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-ink">Khách muốn đổi mẫu khác</td>
                <td className="p-3">Đổi sang mẫu có giá trị tương đương hoặc cao hơn</td>
                <td className="p-3">Khách hàng thanh toán phí chênh lệch và phí vận chuyển (nếu có)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}

/* =========================================================================
   4. CHÍNH SÁCH GIAO HÀNG (SHIPPING POLICY)
   ========================================================================= */
function ShippingContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">GIAO VẬN TOÀN QUỐC</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Chính Sách Vận Chuyển & Đồng Kiểm
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Dịch vụ giao hàng tận nơi chuyên nghiệp trên 63 tỉnh thành qua các đối tác Giao Hàng Nhanh & Viettel Post
        </p>
      </div>

      {/* Delivery Fee Notice Box */}
      <div className="border border-[#e5e5e5] bg-[#fafafa] p-4 flex items-start gap-3 text-xs">
        <div className="w-9 h-9 bg-ink text-white flex items-center justify-center shrink-0">
          <Truck size={18} />
        </div>
        <div>
          <h3 className="font-bold text-ink text-xs uppercase tracking-wide">Chính sách Miễn Phí Vận Chuyển (Freeship)</h3>
          <p className="text-[#555] mt-1 leading-relaxed">
            • <strong>MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC</strong> cho tất cả các đơn hàng từ <strong>499.000₫</strong> trở lên.
            <br />• Đơn hàng dưới 499.000₫: Cước phí vận chuyển đồng giá ưu đãi chỉ <strong>30.000₫/đơn</strong> trên phạm vi toàn quốc.
          </p>
        </div>
      </div>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          1. Thời gian giao hàng dự kiến
        </h2>
        <div className="overflow-x-auto border border-[#e5e5e5]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f4f4f4] text-ink font-bold border-b border-[#e5e5e5]">
              <tr>
                <th className="p-3">Khu vực giao hàng</th>
                <th className="p-3">Thời gian dự kiến</th>
                <th className="p-3">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee] text-[#555]">
              <tr>
                <td className="p-3 font-semibold text-ink">Nội thành Hà Nội & TP. Hồ Chí Minh</td>
                <td className="p-3 font-bold text-ink">1 – 2 ngày làm việc</td>
                <td className="p-3">Giao nhanh trong 24h</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-ink">Ngoại thành & Các tỉnh lân cận</td>
                <td className="p-3 font-bold text-ink">2 – 3 ngày làm việc</td>
                <td className="p-3">Hải Phòng, Đà Nẵng, Bình Dương, Đồng Nai...</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-ink">Các tỉnh/thành miền Trung & Tây Nguyên</td>
                <td className="p-3 font-bold text-ink">2 – 4 ngày làm việc</td>
                <td className="p-3">Huế, Nha Trang, Đắk Lắk...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          2. Chính sách đồng kiểm khi nhận hàng
        </h2>
        <p className="text-xs text-[#555]">
          FashionHub áp dụng chính sách <strong>đồng kiểm hàng khi nhận</strong>: Quý khách được mở bưu kiện kiểm tra số lượng và mẫu mã sản phẩm trước khi thanh toán tiền mặt cho shipper.
        </p>
      </section>
    </article>
  );
}

/* =========================================================================
   5. CHÍNH SÁCH BẢO MẬT DỮ LIỆU CÁ NHÂN (PRIVACY POLICY)
   ========================================================= */
function PrivacyContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">AN TOÀN THÔNG TIN</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Chính Sách Bảo Mật Quyền Riêng Tư
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Cam kết bảo vệ dữ liệu cá nhân theo Nghị định số 13/2023/NĐ-CP của Chính phủ Việt Nam
        </p>
      </div>

      <div className="bg-[#f7f7f8] border-l-2 border-ink p-4 text-xs text-[#555] leading-relaxed">
        <strong className="text-ink font-bold">Cam kết từ FashionHub:</strong> Chúng tôi tôn trọng tối đa quyền riêng tư của bạn. FashionHub{' '}
        <strong>tuyệt đối không bán, cho thuê hoặc thương mại hóa</strong> thông tin cá nhân của khách hàng cho bất kỳ bên thứ ba nào.
      </div>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          1. Thông tin cá nhân chúng tôi thu thập
        </h2>
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-xs text-[#555]">
          <li><strong>Họ tên và số điện thoại:</strong> Dùng để xác nhận đơn hàng và liên hệ giao nhận bưu phẩm.</li>
          <li><strong>Địa chỉ giao nhận:</strong> Tỉnh/thành, quận/huyện, phường/xã và địa chỉ chi tiết nơi nhận hàng.</li>
          <li><strong>Lịch sử đơn hàng:</strong> Danh sách mặt hàng đã mua để hỗ trợ bảo hành và đổi size trong 7 ngày.</li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          2. Bảo mật dữ liệu thanh toán
        </h2>
        <p className="text-xs text-[#555]">
          Mọi giao dịch thanh toán chuyển khoản qua PayOS hoặc ngân hàng đều được mã hóa theo tiêu chuẩn an toàn quốc tế PCI-DSS. FashionHub không lưu trữ mật khẩu hay thông tin tài khoản ngân hàng của quý khách.
        </p>
      </section>
    </article>
  );
}

/* =========================================================================
   6. HƯỚNG DẪN CHỌN SIZE (SIZE GUIDE CHO M, L, XL, 2XL, 3XL)
   ========================================================================= */
function SizeGuideContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">CHỌN SIZE VỪA VẶN</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Bảng Kích Cỡ Chuẩn Nam (M – 3XL)
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Bảng thông số đối chiếu chiều cao, cân nặng và số đo chuẩn người Việt cho thời trang nam FashionHub
        </p>
      </div>

      {/* Male Tops Size Table (Áo thun, Polo, Sơ mi, Áo khoác, Áo nỉ) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
            1. Bảng Size Áo Nam (Áo phông, Polo, Sơ mi, Áo khoác, Áo nỉ)
          </h2>
          <span className="text-[11px] text-[#767676]">Đơn vị: cm, kg</span>
        </div>
        <div className="overflow-x-auto border border-[#e5e5e5]">
          <table className="w-full text-xs text-center">
            <thead className="bg-[#f4f4f4] text-ink font-bold border-b border-[#e5e5e5]">
              <tr>
                <th className="p-3 text-left">Size</th>
                <th className="p-3">Chiều cao (cm)</th>
                <th className="p-3">Cân nặng (kg)</th>
                <th className="p-3">Vòng ngực (cm)</th>
                <th className="p-3">Dài áo (cm)</th>
                <th className="p-3">Rộng vai (cm)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee] text-[#555]">
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">M</td>
                <td className="p-3">160 – 168</td>
                <td className="p-3 font-semibold text-ink">52 – 60 kg</td>
                <td className="p-3">88 – 92</td>
                <td className="p-3">67 – 69</td>
                <td className="p-3">42 – 43</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">L</td>
                <td className="p-3">168 – 174</td>
                <td className="p-3 font-semibold text-ink">61 – 69 kg</td>
                <td className="p-3">93 – 97</td>
                <td className="p-3">70 – 72</td>
                <td className="p-3">44 – 45</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">XL</td>
                <td className="p-3">173 – 178</td>
                <td className="p-3 font-semibold text-ink">70 – 78 kg</td>
                <td className="p-3">98 – 103</td>
                <td className="p-3">73 – 75</td>
                <td className="p-3">46 – 47</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">2XL</td>
                <td className="p-3">176 – 183</td>
                <td className="p-3 font-semibold text-ink">79 – 86 kg</td>
                <td className="p-3">104 – 109</td>
                <td className="p-3">76 – 78</td>
                <td className="p-3">48 – 49</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">3XL</td>
                <td className="p-3">180 – 188</td>
                <td className="p-3 font-semibold text-ink">87 – 96+ kg</td>
                <td className="p-3">110 – 116</td>
                <td className="p-3">78 – 80</td>
                <td className="p-3">50 – 52</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Male Bottoms Size Table (Quần jeans, Kaki, Quần âu, Quần short) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
            2. Bảng Size Quần Nam (Jeans, Kaki, Quần Âu, Short)
          </h2>
          <span className="text-[11px] text-[#767676]">Đơn vị: cm, kg</span>
        </div>
        <div className="overflow-x-auto border border-[#e5e5e5]">
          <table className="w-full text-xs text-center">
            <thead className="bg-[#f4f4f4] text-ink font-bold border-b border-[#e5e5e5]">
              <tr>
                <th className="p-3 text-left">Size chữ</th>
                <th className="p-3">Size số</th>
                <th className="p-3">Vòng eo (cm)</th>
                <th className="p-3">Vòng mông (cm)</th>
                <th className="p-3">Dài quần (cm)</th>
                <th className="p-3">Cân nặng (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee] text-[#555]">
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">M</td>
                <td className="p-3 font-semibold text-ink">28 – 29</td>
                <td className="p-3">72 – 76</td>
                <td className="p-3">88 – 92</td>
                <td className="p-3">96 – 98</td>
                <td className="p-3 font-semibold text-ink">52 – 60 kg</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">L</td>
                <td className="p-3 font-semibold text-ink">30 – 31</td>
                <td className="p-3">77 – 82</td>
                <td className="p-3">93 – 97</td>
                <td className="p-3">98 – 100</td>
                <td className="p-3 font-semibold text-ink">61 – 69 kg</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">XL</td>
                <td className="p-3 font-semibold text-ink">32 – 33</td>
                <td className="p-3">83 – 88</td>
                <td className="p-3">98 – 103</td>
                <td className="p-3">100 – 102</td>
                <td className="p-3 font-semibold text-ink">70 – 78 kg</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">2XL</td>
                <td className="p-3 font-semibold text-ink">34</td>
                <td className="p-3">89 – 93</td>
                <td className="p-3">104 – 108</td>
                <td className="p-3">102 – 104</td>
                <td className="p-3 font-semibold text-ink">79 – 86 kg</td>
              </tr>
              <tr className="hover:bg-[#fafafa]">
                <td className="p-3 text-left font-black text-brand text-sm">3XL</td>
                <td className="p-3 font-semibold text-ink">36</td>
                <td className="p-3">94 – 100</td>
                <td className="p-3">109 – 115</td>
                <td className="p-3">103 – 105</td>
                <td className="p-3 font-semibold text-ink">87 – 96+ kg</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Measuring Guide & Fit Tips */}
      <section className="space-y-3 pt-2">
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-ink">
          3. Mẹo Đo Cơ Thể & Lời Khuyên Chọn Size
        </h2>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 border border-[#e5e5e5] bg-[#fafafa]">
            <div className="font-bold text-ink mb-1">Ưu tiên cân nặng</div>
            <p className="text-[#555]">
              Nếu chiều cao và cân nặng của bạn nằm ở 2 size khác nhau, nên ưu tiên chọn size theo mức <strong>cân nặng</strong> để đảm bảo độ thoải mái khi vận động.
            </p>
          </div>
          <div className="p-3.5 border border-[#e5e5e5] bg-[#fafafa]">
            <div className="font-bold text-ink mb-1">Chọn phom dáng</div>
            <p className="text-[#555]">
              Thích mặc vừa vặn (Regular fit): chọn đúng size theo bảng. Thích mặc rộng rãi, phóng khoáng (Loose / Oversized): nên tăng 1 size.
            </p>
          </div>
          <div className="p-3.5 border border-[#e5e5e5] bg-[#fafafa]">
            <div className="font-bold text-ink mb-1">Đổi size miễn phí</div>
            <p className="text-[#555]">
              Nếu nhận hàng mặc chưa vừa, FashionHub hỗ trợ đổi size trong vòng <strong>7 ngày</strong> tại bất kỳ cửa hàng nào trên toàn quốc hoặc qua bưu điện.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

/* =========================================================================
   7. VỀ FASHIONHUB (ABOUT US)
   ========================================================================= */
function AboutContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">CÂU CHUYỆN THƯƠNG HIỆU</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          FashionHub — Thời Trang Thiết Yếu Mỗi Ngày
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Thời trang tối giản, chất lượng cao, bền vững và tôn vinh phong cách sống hiện đại
        </p>
      </div>

      <p className="text-xs sm:text-sm leading-relaxed text-[#555]">
        Ra đời từ mong muốn đơn giản hóa việc lựa chọn trang phục mỗi ngày, <strong>FashionHub</strong> tin rằng phong cách đẹp nhất chính là sự thoải mái và tự tin khi là chính mình. Chúng tôi tập trung tạo nên những sản phẩm cơ bản, tinh tế với chất liệu bền bỉ và dễ phối hợp cho mọi hoạt động từ công sở đến dạo phố cuối tuần.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 pt-1">
        <div className="p-4 border border-[#e5e5e5] bg-[#fafafa] text-center">
          <div className="text-xl font-black text-brand mb-1">01</div>
          <h3 className="font-bold text-ink text-xs uppercase tracking-wide mb-1">Tối Giản & Tinh Tế</h3>
          <p className="text-xs text-[#666]">Thiết kế chú trọng phom dáng chuẩn mực, bền bỉ theo thời gian.</p>
        </div>
        <div className="p-4 border border-[#e5e5e5] bg-[#fafafa] text-center">
          <div className="text-xl font-black text-brand mb-1">02</div>
          <h3 className="font-bold text-ink text-xs uppercase tracking-wide mb-1">Chất Liệu Tuyển Chọn</h3>
          <p className="text-xs text-[#666]">Ưu tiên sợi tự nhiên, cotton thoáng mát, thân thiện với làn da.</p>
        </div>
        <div className="p-4 border border-[#e5e5e5] bg-[#fafafa] text-center">
          <div className="text-xl font-black text-brand mb-1">03</div>
          <h3 className="font-bold text-ink text-xs uppercase tracking-wide mb-1">Giá Trị Thực Sự</h3>
          <p className="text-xs text-[#666]">Tối ưu chi phí để mang đến mức giá dễ tiếp cận nhất cho khách hàng.</p>
        </div>
      </div>
    </article>
  );
}

/* =========================================================================
   8. LIÊN HỆ HỖ TRỢ (CONTACT US)
   ========================================================================= */
function ContactContent() {
  return (
    <article className="space-y-6 text-sm text-[#444] leading-relaxed">
      <div className="border-b border-[#eee] pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#767676]">HỖ TRỢ KHÁCH HÀNG</span>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase text-ink mt-1 tracking-tight">
          Liên Hệ & Trung Tâm Trợ Giúp
        </h1>
        <p className="text-xs text-[#767676] mt-1">
          Chúng tôi luôn sẵn sàng lắng nghe, hỗ trợ xử lý đơn hàng và tiếp nhận mọi ý kiến đóng góp
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border border-[#e5e5e5] p-5 bg-[#fafafa] space-y-1.5">
          <div className="w-8 h-8 bg-ink text-white flex items-center justify-center">
            <PhoneCall size={16} />
          </div>
          <h3 className="font-bold text-ink text-xs uppercase tracking-wide pt-1">Tổng đài chăm sóc khách hàng</h3>
          <div className="text-lg font-black text-brand tracking-tight">1800 6000</div>
          <p className="text-xs text-[#666]">Miễn phí cuộc gọi · 8:00 – 21:30 (Cả tuần)</p>
        </div>

        <div className="border border-[#e5e5e5] p-5 bg-[#fafafa] space-y-1.5">
          <div className="w-8 h-8 bg-ink text-white flex items-center justify-center">
            <Mail size={16} />
          </div>
          <h3 className="font-bold text-ink text-xs uppercase tracking-wide pt-1">Email hỗ trợ chính thức</h3>
          <div className="text-base font-bold text-ink">support@fashionhub.vn</div>
          <p className="text-xs text-[#666]">Phản hồi giải quyết trong vòng 24 giờ làm việc</p>
        </div>
      </div>

      <div className="border border-[#e5e5e5] p-5 bg-white text-xs space-y-2">
        <div className="font-bold text-ink text-xs uppercase tracking-wide flex items-center gap-1.5">
          <MapPin size={15} className="text-brand" /> Hệ thống cửa hàng trên toàn quốc
        </div>
        <p className="text-[#555]">
          FashionHub hiện có 10 cửa hàng tại Hà Nội, TP. Hồ Chí Minh và Đà Nẵng. Bạn có thể ghé thăm trực tiếp hoặc tra cứu vị trí trên bản đồ.
        </p>
        <Link
          to="/stores"
          className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline pt-1"
        >
          <span>Xem hệ thống 10 cửa hàng & vị trí Google Maps</span>
          <ChevronRight size={14} />
        </Link>
      </div>
    </article>
  );
}

export function StatusPage({ code }: { code: '403' | '404' | '500' }) {
  const title =
    code === '403'
      ? 'Bạn không có quyền truy cập'
      : code === '404'
        ? 'Không tìm thấy trang'
        : 'Hệ thống tạm thời gặp lỗi';
  return (
    <div className="container-shell py-20 text-center">
      <div className="text-7xl font-black text-brand mb-4">{code}</div>
      <h1 className="text-2xl font-bold mb-3">{title}</h1>
      <p className="text-slate-500 mb-6">Hãy quay lại trang chủ hoặc tiếp tục khám phá cửa hàng.</p>
      <Link to="/" className="btn-primary inline-block">
        Về trang chủ
      </Link>
    </div>
  );
}
