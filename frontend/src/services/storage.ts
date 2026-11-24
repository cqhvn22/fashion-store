export const SYNC_CHANNEL_NAME = 'fashionhub_sync_channel';

export const currentTabId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'tab_' + Math.random().toString(36).slice(2);

export function broadcastSync(key: string) {
  try {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.postMessage({ key, tabId: currentTabId, at: Date.now() });
      bc.close();
    }
  } catch {
    /* ignore cross-origin / unsupported environments */
  }
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage quota exceeded */
  }
  broadcastSync(key);
}
