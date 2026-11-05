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
    <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="text-slate-500 mt-2">{description}</p>}
      </div>
      {action}
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
      <PackageOpen size={38} strokeWidth={1.4} className="text-slate-400 mb-4" />
      <h2 className="font-semibold text-lg">{title}</h2>
      {description && <p className="text-slate-500 mt-1 mb-4">{description}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }: { error?: Error | null; retry?: () => void }) {
  return (
    <div className="state-box">
      <AlertCircle size={38} className="text-red-500 mb-4" />
      <h2 className="font-semibold">Đã có lỗi xảy ra</h2>
      <p className="text-slate-500 mt-1 mb-4">{error?.message ?? 'Vui lòng thử lại sau.'}</p>
      {retry && (
        <button className="btn-primary" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}
export function ProductSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="bg-white rounded-md overflow-hidden animate-pulse">
          <div className="aspect-[4/5] bg-slate-200" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-slate-200 rounded" />
            <div className="h-4 w-2/3 bg-slate-200 rounded" />
            <div className="h-5 w-1/2 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
export function SectionHeading({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h2>
      {href && (
        <Link className="text-brand font-medium flex items-center gap-1 hover:underline" to={href}>
          Xem tất cả <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
