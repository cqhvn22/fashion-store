import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { notificationService } from '../services/notifications';
import { useAuthStore } from '../stores/authStore';
import { formatDate } from '../utils/format';

export function NotificationBell() {
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const wrapper = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const client = useQueryClient();
  const enabled = !!user;

  const { data: notifications = [], error } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => notificationService.list(),
    enabled,
    refetchOnWindowFocus: true,
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ['notification-count', user?.id],
    queryFn: () => notificationService.unreadCount(),
    enabled,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['notifications', user?.id] }),
      client.invalidateQueries({ queryKey: ['notification-count', user?.id] }),
    ]);

  useEffect(() => {
    if (!enabled) return;
    const handleUpdate = () => {
      void refresh();
    };
    window.addEventListener('fashionhub-notifications-changed', handleUpdate);
    window.addEventListener('fashionhub-notification-toast', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('fashionhub-notifications-changed', handleUpdate);
      window.removeEventListener('fashionhub-notification-toast', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [enabled, user?.id]);

  if (!enabled) return null;

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        className="header-icon-button relative"
        aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            void refresh();
          }
          setOpen(!open);
        }}
      >
        <Bell size={21} strokeWidth={1.7} />
        {unread > 0 && (
          <span
            data-testid="notification-unread-count"
            className="cart-count bg-brand text-white animate-fade-in"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-[min(90vw,380px)] max-h-[440px] overflow-y-auto rounded-2xl bg-white text-ink shadow-2xl border border-slate-200 z-50">
          <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <strong>Thông báo</strong>
              {unread > 0 && (
                <span className="text-xs text-brand font-semibold">({unread} chưa đọc)</span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                className="text-sm font-medium text-brand hover:underline"
                onClick={async () => {
                  try {
                    await notificationService.markAllRead();
                    await refresh();
                    setActionError('');
                  } catch {
                    setActionError('Không cập nhật được thông báo.');
                  }
                }}
              >
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          {(error || actionError) && (
            <p className="px-4 py-3 text-sm text-red-600" role="alert">
              {actionError || 'Không tải được thông báo.'}
            </p>
          )}
          {!error && !notifications.length && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Bạn chưa có thông báo nào.
            </p>
          )}
          {notifications.map((item) => (
            <Link
              key={item.id}
              to={
                item.orderId
                  ? user?.role === 'ADMIN'
                    ? `/admin/orders/${item.orderId}`
                    : `/account/orders/${item.orderId}`
                  : '#'
              }
              onClick={() => {
                setOpen(false);
                if (!item.readAt) {
                  void notificationService.markRead(item.id).then(refresh).catch(() => undefined);
                }
              }}
              className={`block px-4 py-3 border-b last:border-0 hover:bg-orange-50 transition-colors ${
                item.readAt ? 'bg-white' : 'bg-[#fff5ef]'
              }`}
            >
              <span className="flex justify-between gap-3 items-start">
                <strong className="text-sm text-ink">{item.subject || 'Thông báo'}</strong>
                {!item.readAt && (
                  <span
                    aria-label="Chưa đọc"
                    title="Chưa đọc"
                    className="shrink-0 w-2.5 h-2.5 mt-1 rounded-full bg-brand ring-2 ring-orange-200"
                  />
                )}
              </span>
              <span className="block text-sm text-slate-700 mt-1 leading-snug">{item.body}</span>
              <small className="text-slate-400 text-xs block mt-1">
                {formatDate(item.createdAt)}
              </small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
