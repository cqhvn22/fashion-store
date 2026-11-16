import type { ReactNode } from 'react';
import { AlertCircle, ArrowRight, PackageOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pb-4 border-b border-[#eee]">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="text-sm text-[#666] mt-2 max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  href,
  linkText = 'XEM TẤT CẢ',
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkText?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6 pb-2 border-b-2 border-ink">
      <div>
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="text-xs text-[#767676] mt-1">{subtitle}</p>}
      </div>
      {href && (
        <Link
          className="text-xs font-bold tracking-wider text-ink hover:text-brand flex items-center gap-1 uppercase transition-colors"
          to={href}
        >
          {linkText} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-box">
      <PackageOpen size={42} strokeWidth={1.5} className="text-[#888] mb-4" />
      <h2 className="font-bold text-lg text-ink uppercase tracking-wide">{title}</h2>
      {description && <p className="text-sm text-[#666] mt-1 mb-5">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error?: Error | null; retry?: () => void }) {
  return (
    <div className="state-box">
      <AlertCircle size={42} className="text-brand mb-4" />
      <h2 className="font-bold text-lg text-ink uppercase tracking-wide">Đã có lỗi xảy ra</h2>
      <p className="text-sm text-[#666] mt-1 mb-5">{error?.message ?? 'Vui lòng thử lại sau.'}</p>
      {retry && (
        <button className="btn-primary" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function ProductSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-white">
          {/* 3:4 Image Skeleton with Shimmer */}
          <div className="aspect-[3/4] shimmer-box w-full mb-3" />

          {/* Swatch Skeleton Dots */}
          <div className="flex gap-1.5 mb-2.5">
            <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
            <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
            <div className="w-3.5 h-3.5 rounded-full shimmer-box" />
          </div>

          {/* Category Tag */}
          <div className="h-3 w-12 shimmer-box mb-2" />

          {/* Title Lines */}
          <div className="space-y-1.5 mb-2.5">
            <div className="h-3.5 w-full shimmer-box" />
            <div className="h-3.5 w-2/3 shimmer-box" />
          </div>

          {/* Price */}
          <div className="h-4 w-28 shimmer-box" />
        </div>
      ))}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'dark';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
