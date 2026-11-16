import type { QueryClient } from '@tanstack/react-query';
import { SYNC_CHANNEL_NAME, currentTabId } from './storage';
import { useCartStore } from '../stores/cartStore';
import { useWishlistStore } from '../stores/wishlistStore';
import { useAuthStore } from '../stores/authStore';
import { getStoredMockNotifications } from './notifications';

let isInitialized = false;

export function setupGlobalSync(queryClient: QueryClient): () => void {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {};
  }
  isInitialized = true;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const handleKeySync = (key: string | null) => {
    // Only react to explicit cross-tab change events (no blind spamming)
    if (!key) return;

    if (key === 'fashionhub_orders') {
      void queryClient.invalidateQueries({ queryKey: ['order'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    }

    if (key === 'fashionhub_promotions') {
      void queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    }

    if (key === 'fashionhub_products' || key === 'fashionhub_categories') {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['product'] });
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    }

    if (key === 'fashionhub_cart') {
      try {
        void useCartStore.persist.rehydrate();
      } catch {
        /* ignore */
      }
    }

    if (key === 'fashionhub_wishlist') {
      try {
        void useWishlistStore.persist.rehydrate();
        void queryClient.invalidateQueries({ queryKey: ['wishlist-products'] });
      } catch {
        /* ignore */
      }
    }

    if (key === 'fashionhub_saved_addresses') {
      void queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      void queryClient.invalidateQueries({ queryKey: ['addresses'] });
    }

    if (key === 'fashionhub_notifications') {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-count'] });

      try {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const items = getStoredMockNotifications();
          const latest = items[0];
          if (
            latest &&
            !latest.readAt &&
            Date.now() - new Date(latest.createdAt).getTime() < 10000 &&
            (latest.recipientUserId === currentUser.id ||
              (currentUser.role === 'ADMIN' && (latest.recipientUserId === 'admin-demo' || latest.recipientUserId === currentUser.id)))
          ) {
            window.dispatchEvent(
              new CustomEvent('fashionhub-notification-toast', {
                detail: {
                  id: latest.id,
                  subject: latest.subject,
                  body: latest.body,
                  orderId: latest.orderId,
                },
              })
            );
          }
        }
      } catch {
        /* ignore */
      }
    }
  };

  const scheduleSync = (key: string | null) => {
    if (!key) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handleKeySync(key);
    }, 100);
  };

  // 1. Cross-tab storage event (fired by other tabs on localStorage changes)
  const onStorage = (event: StorageEvent) => {
    if (event.key) {
      scheduleSync(event.key);
    }
  };
  window.addEventListener('storage', onStorage);

  // 2. BroadcastChannel across tabs/windows (ignores messages from the same tab)
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.tabId && event.data.tabId === currentTabId) return;
        scheduleSync(event.data?.key ?? null);
      };
    } catch {
      /* ignore */
    }
  }

  return () => {
    isInitialized = false;
    window.removeEventListener('storage', onStorage);
    if (bc) {
      bc.close();
      bc = null;
    }
  };
}
