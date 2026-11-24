import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { demoUsers } from '../mocks/catalog';
import type { User } from '../types/models';
import { endpoints } from '../services/endpoints';
import { clearTokens, currentAccessToken, hasAccessToken, httpClient, refreshAccessToken, savedRefreshToken, saveTokens, useDbAuth } from '../services/httpClient';
import { readLocal, writeLocal } from '../services/storage';
interface AuthState {
  user: User | null;
  ready: boolean;
  restoreAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  update: (input: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => void;
}
async function mockDigest(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
interface MockAccount {
  user: User;
  salt: string;
  digest: string;
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      ready: false,
      restoreAuth: async () => {
        if (get().ready) return;
        if (!useDbAuth) { set({ ready: true }); return; }
        if (!savedRefreshToken() && !hasAccessToken()) {
          set({ user: null, ready: true }); return;
        }
        try {
          if (savedRefreshToken()) await refreshAccessToken();
          const { data } = await httpClient.get<{ data: User }>(endpoints.auth.me);
          set({ user: data.data, ready: true });
        } catch { clearTokens(); set({ user: null, ready: true }); }
      },
      login: async (email, password) => {
        if (!useDbAuth) {
          const registered = readLocal<MockAccount[]>('fashionhub_registered', []);
          const demo = demoUsers.find(
            (item) => item.email === email.toLowerCase() && password === 'Demo@123'
              && !registered.some((entry) => entry.user.id === item.id),
          );
          const custom = registered.find((item) => item.user.email === email.toLowerCase());
          const user =
            demo ??
            (custom && (await mockDigest(password, custom.salt)) === custom.digest
              ? custom.user
              : null);
          if (!user) throw new Error('Email hoặc mật khẩu không đúng.');
          set({ user });
          return;
        }
        const { data } = await httpClient.post<{ data: { user: User; accessToken: string; refreshToken: string } }>(
          endpoints.auth.login,
          { email, password },
        );
        saveTokens(data.data.accessToken, data.data.refreshToken);
        set({ user: data.data.user });
      },
      register: async (input) => {
        if (!useDbAuth) {
          const registered = readLocal<MockAccount[]>('fashionhub_registered', []);
          if (
            [...demoUsers, ...registered.map((item) => item.user)].some(
              (item) => item.email === input.email.toLowerCase(),
            )
          )
            throw new Error('Email đã được sử dụng.');
          const user: User = {
            id: crypto.randomUUID(),
            fullName: input.fullName,
            email: input.email.toLowerCase(),
            phone: input.phone,
            role: 'USER',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          };
          const salt = crypto.randomUUID();
          writeLocal('fashionhub_registered', [
            ...registered,
            { user, salt, digest: await mockDigest(input.password, salt) },
          ]);
          set({ user });
          return;
        }
        await httpClient.post(endpoints.auth.register, input);
        const { data } = await httpClient.post<{ data: { user: User; accessToken: string; refreshToken: string } }>(
          endpoints.auth.login,
          { email: input.email, password: input.password },
        );
        saveTokens(data.data.accessToken, data.data.refreshToken);
        set({ user: data.data.user });
      },
      update: async (input) => {
        const user = get().user;
        if (!user) throw new Error('Vui lòng đăng nhập.');
        if (!useDbAuth) {
          set({ user: { ...user, ...input } });
          return;
        }
        const { data } = await httpClient.put<{ data: User }>(endpoints.auth.me, input);
        set({ user: data.data });
      },
      changePassword: async (currentPassword, newPassword) => {
        const user = get().user;
        if (!user) throw new Error('Vui lòng đăng nhập.');
        if (!useDbAuth) {
          const registered = readLocal<MockAccount[]>('fashionhub_registered', []);
          const index = registered.findIndex((entry) => entry.user.id === user.id);
          const current = index >= 0
            ? (await mockDigest(currentPassword, registered[index].salt)) === registered[index].digest
            : demoUsers.some((item) => item.id === user.id) && currentPassword === 'Demo@123';
          if (!current) throw new Error('Mật khẩu hiện tại không đúng.');
          const salt = crypto.randomUUID();
          const next = { user, salt, digest: await mockDigest(newPassword, salt) };
          if (index >= 0) registered[index] = next;
          else registered.push(next);
          writeLocal('fashionhub_registered', registered);
          return;
        }
        await httpClient.put(`${endpoints.auth.me}/password`, { currentPassword, newPassword });
      },
      logout: () => {
        const token = currentAccessToken();
        const refreshToken = savedRefreshToken();
        if (useDbAuth && token)
          void httpClient.post(endpoints.auth.logout, { refreshToken }, {
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);
        clearTokens();
        set({ user: null });
      },
    }),
    {
      name: useDbAuth ? 'fashionhub_auth_db' : 'fashionhub_auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
