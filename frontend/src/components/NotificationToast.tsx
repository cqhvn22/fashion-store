import { useEffect, useState } from 'react';
import { Bell, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface ToastData {
  id: string;
  subject: string | null;
  body: string;
  orderId?: string | null;
}

export function NotificationToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastData>;
      if (customEvent.detail) {
        setToast(customEvent.detail);
      }
    };

    window.addEventListener('fashionhub-notification-toast', onToast);
    return () => window.removeEventListener('fashionhub-notification-toast', onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast || !user) return null;

  const handleClick = () => {
    if (toast.orderId) {
      if (user.role === 'ADMIN') {
        navigate(`/admin/orders/${toast.orderId}`);
      } else {
        navigate(`/account/orders/${toast.orderId}`);
      }
    }
    setToast(null);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-5 right-5 z-[100] max-w-sm w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 transition-all duration-300 animate-in fade-in slide-in-from-top-4 flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-full bg-orange-100 text-brand flex items-center justify-center shrink-0 mt-0.5">
        <Bell size={20} className="animate-bounce" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm font-bold text-ink truncate">
            {toast.subject || 'Thông báo mới'}
          </strong>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-ink transition-colors p-0.5 rounded-full"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
          {toast.body}
        </p>

        {toast.orderId && (
          <button
            type="button"
            onClick={handleClick}
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
          >
            <span>Xem chi tiết đơn hàng</span>
            <ExternalLink size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
