import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { demoUsers } from '../mocks/catalog';
import type { User } from '../types/models';
import { endpoints } from '../services/endpoints';
import { httpClient, mockMode } from '../services/httpClient';
import { readLocal, writeLocal } from '../services/storage';
interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  update: (input: Partial<User>) => Promise<void>;
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
      login: async (email, password) => {
        if (mockMode) {
          const registered = readLocal<MockAccount[]>('fashionhub_registered', []);
          const demo = demoUsers.find(
            (item) => item.email === email.toLowerCase() && password === 'Demo@123',
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
        const { data } = await httpClient.post<{ data: { user: User; accessToken?: string } }>(
          endpoints.auth.login,
          { email, password },
        );
        if (data.data.accessToken)
          sessionStorage.setItem('fashionhub_access_token', data.data.accessToken);
        set({ user: data.data.user });
      },
      register: async (input) => {
        if (mockMode) {
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
        const { data } = await httpClient.post<{ data: User }>(endpoints.auth.register, input);
        set({ user: data.data });
      },
      update: async (input) => {
        const user = get().user;
        if (!user) throw new Error('Vui lòng đăng nhập.');
        if (mockMode) {
          set({ user: { ...user, ...input } });
          return;
        }
        const { data } = await httpClient.put<{ data: User }>(endpoints.auth.me, input);
        set({ user: data.data });
      },
      logout: () => {
        sessionStorage.removeItem('fashionhub_access_token');
        set({ user: null });
        if (!mockMode) void httpClient.post(endpoints.auth.logout).catch(() => undefined);
      },
    }),
    { name: 'fashionhub_auth' },
  ),
);
