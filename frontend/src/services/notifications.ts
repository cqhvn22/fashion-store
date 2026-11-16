import type { InAppNotification } from '../types/models';
import { httpClient, useDbAuth } from './httpClient';
import { readLocal, writeLocal } from './storage';
import { useAuthStore } from '../stores/authStore';

const key = 'fashionhub_notifications';
const devSyncUrl = '/api/dev-mock/fashionhub_notifications';

export const defaultMockNotifications: (InAppNotification & { recipientUserId: string })[] = [
  {
    id: 'notif-demo-1',
    recipientUserId: 'user-demo',
    orderId: '0153fae9-0007-4385-82eb-1a65642d17ff',
    subject: 'Đơn hàng mới',
    body: 'Đơn FH-1794390466932 đã được đặt thành công.',
    readAt: null,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif-demo-2',
    recipientUserId: 'user-demo',
    orderId: '0153fae9-0007-4385-82eb-1a65642d17ff',
    subject: 'Cập nhật trạng thái đơn hàng',
    body: 'Đơn hàng FH-1794390466932 của bạn đã chuyển sang trạng thái "Đang chuẩn bị".',
    readAt: null,
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'notif-demo-admin-1',
    recipientUserId: 'admin-demo',
    orderId: '0153fae9-0007-4385-82eb-1a65642d17ff',
    subject: 'Đơn hàng mới từ khách',
    body: 'Có đơn hàng FH-1794390466932 vừa được đặt (Nguyễn Minh Anh - 319.000 đ).',
    readAt: null,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

export function getStoredMockNotifications(): (InAppNotification & { recipientUserId: string })[] {
  return readLocal(key, defaultMockNotifications);
}

export function saveStoredMockNotifications(items: (InAppNotification & { recipientUserId: string })[]) {
  writeLocal(key, items);
  void pushDevServerMockNotifications(items);
}

export async function fetchDevServerMockNotifications(): Promise<(InAppNotification & { recipientUserId: string })[] | null> {
  if (typeof window === 'undefined' || useDbAuth || typeof location === 'undefined' || !location.origin.startsWith('http')) return null;
  try {
    const res = await fetch(devSyncUrl);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

export async function pushDevServerMockNotifications(items: (InAppNotification & { recipientUserId: string })[]): Promise<void> {
  if (typeof window === 'undefined' || useDbAuth || typeof location === 'undefined' || !location.origin.startsWith('http')) return;
  try {
    await fetch(devSyncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items),
    });
  } catch {
    // Ignore errors in offline / testing environments
  }
}

export function getOrderKey(item: {
  orderId?: string | null;
  subject?: string | null;
  body?: string;
}): string | null {
  const text = `${item.subject || ''} ${item.body || ''}`;
  const match = text.match(/\b(FH-[A-Za-z0-9_-]+)\b/i);
  if (match) {
    return `code:${match[1].toUpperCase()}`;
  }
  if (item.orderId && item.orderId.trim()) {
    return `id:${item.orderId.trim()}`;
  }
  return null;
}

export function groupNotificationsByOrder<T extends InAppNotification>(items: T[]): T[] {
  // Sort descending by creation date (newest first)
  const sorted = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const seenOrderKeys = new Set<string>();
  const grouped: T[] = [];

  for (const item of sorted) {
    const key = getOrderKey(item);
    if (!key) {
      grouped.push(item);
    } else {
      if (!seenOrderKeys.has(key)) {
        seenOrderKeys.add(key);
        grouped.push(item);
      }
      // Older items belonging to the same order are skipped so only the latest status is displayed
    }
  }

  return grouped;
}

export function addMockNotification(data: {
  recipientUserId: string;
  orderId?: string | null;
  subject: string;
  body: string;
}): InAppNotification & { recipientUserId: string } {
  const newNotif: InAppNotification & { recipientUserId: string } = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recipientUserId: data.recipientUserId,
    orderId: data.orderId ?? null,
    subject: data.subject,
    body: data.body,
    readAt: null,
    createdAt: new Date().toISOString(),
  };

  const list = [newNotif, ...getStoredMockNotifications()];
  saveStoredMockNotifications(list);

  // Trigger in-app toast and badge change events
  if (typeof window !== 'undefined') {
    const currentUser = useAuthStore.getState().user;
    if (
      currentUser &&
      (currentUser.id === data.recipientUserId ||
        (currentUser.role === 'ADMIN' && (data.recipientUserId === 'admin-demo' || data.recipientUserId === currentUser.id)))
    ) {
      window.dispatchEvent(
        new CustomEvent('fashionhub-notification-toast', {
          detail: {
            id: newNotif.id,
            subject: newNotif.subject,
            body: newNotif.body,
            orderId: newNotif.orderId,
          },
        })
      );
    }
    window.dispatchEvent(
      new CustomEvent('fashionhub-notifications-changed', {
        detail: {
          id: newNotif.id,
          recipientUserId: data.recipientUserId,
          orderId: data.orderId,
        },
      })
    );
  }

  return newNotif;
}

export const notificationService = {
  async list(): Promise<InAppNotification[]> {
    if (useDbAuth) {
      const { data } = await httpClient.get<{ data: InAppNotification[] }>('/notifications');
      return groupNotificationsByOrder(data.data);
    }

    const user = useAuthStore.getState().user;
    if (!user) return [];

    // Optional background sync with dev server
    void fetchDevServerMockNotifications().then((remote) => {
      if (remote && remote.length > 0) {
        const local = getStoredMockNotifications();
        const map = new Map<string, InAppNotification & { recipientUserId: string }>();
        for (const item of local) map.set(item.id, item);
        for (const item of remote) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        if (merged.length !== local.length) {
          writeLocal(key, merged);
        }
      }
    });

    const items = getStoredMockNotifications();
    const userItems = items.filter(
      (item) =>
        item.recipientUserId === user.id ||
        (user.role === 'ADMIN' && (item.recipientUserId === 'admin-demo' || item.recipientUserId === user.id))
    );

    return groupNotificationsByOrder(userItems).slice(0, 50);
  },

  async unreadCount(): Promise<number> {
    if (useDbAuth) {
      const { data } = await httpClient.get<{ data: { count: number } }>('/notifications/unread-count');
      return Number(data.data.count);
    }

    const items = await notificationService.list();
    return items.filter((item) => !item.readAt).length;
  },

  async markRead(id: string): Promise<void> {
    if (useDbAuth) {
      await httpClient.patch(`/notifications/${id}/read`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fashionhub-notifications-changed', { detail: { id } }));
      }
      return;
    }

    const items = getStoredMockNotifications();
    const target = items.find((item) => item.id === id);
    if (!target) return;

    const targetKey = getOrderKey(target);
    const now = new Date().toISOString();

    const updated = items.map((item) => {
      if (item.id === id || (targetKey && getOrderKey(item) === targetKey)) {
        return { ...item, readAt: item.readAt || now };
      }
      return item;
    });

    saveStoredMockNotifications(updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fashionhub-notifications-changed', { detail: { id } }));
    }
  },

  async markAllRead(): Promise<void> {
    if (useDbAuth) {
      await httpClient.patch('/notifications/read-all');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fashionhub-notifications-changed'));
      }
      return;
    }

    const user = useAuthStore.getState().user;
    if (!user) return;

    const items = getStoredMockNotifications();
    const now = new Date().toISOString();
    const updated = items.map((item) => {
      const matches =
        item.recipientUserId === user.id ||
        (user.role === 'ADMIN' && (item.recipientUserId === 'admin-demo' || item.recipientUserId === user.id));
      return matches ? { ...item, readAt: item.readAt || now } : item;
    });

    saveStoredMockNotifications(updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fashionhub-notifications-changed'));
    }
  },
};
