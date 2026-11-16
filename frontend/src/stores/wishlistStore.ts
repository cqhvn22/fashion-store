import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface WishlistState {
  ids: string[];
  toggle: (id: string) => void;
  replaceIds: (replacements: Record<string, string>) => void;
}
export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id)
            ? state.ids.filter((item) => item !== id)
            : [...state.ids, id],
        })),
      replaceIds: (replacements) => set((state) => ({
        ids: [...new Set(state.ids.map((id) => replacements[id] ?? id))],
      })),
    }),
    { name: 'fashionhub_wishlist' },
  ),
);
