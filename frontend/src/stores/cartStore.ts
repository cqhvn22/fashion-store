import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductVariant } from '../types/models';
interface CartState {
  items: CartItem[];
  add: (product: Product, variant: ProductVariant, quantity: number) => void;
  syncProduct: (product: Product) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  removeSelected: () => void;
  clear: () => void;
}

export function consolidateCartItems(items: CartItem[]): CartItem[] {
  const grouped = new Map<string, CartItem>();
  for (const item of items) {
    const key = `${item.productId}:${item.variantId}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...item });
      continue;
    }
    const availableStock = item.availableStock ?? existing.availableStock;
    grouped.set(key, {
      ...existing,
      quantity: Math.min(existing.quantity + item.quantity, availableStock ?? Infinity),
      availableStock,
      selected: existing.selected || item.selected,
    });
  }
  return [...grouped.values()];
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, variant, quantity) =>
        set((state) => {
          const id = variant.id;
          const existing = state.items.find((item) => item.id === id);
          if (existing)
            return {
              items: state.items.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      quantity: Math.min(variant.stockQuantity, item.quantity + quantity),
                      availableStock: variant.stockQuantity,
                      unitPrice: variant.price,
                      imageUrl: variant.imageUrl || product.images[0]?.url || item.imageUrl,
                    }
                  : item,
              ),
            };
          return {
            items: [
              ...state.items,
              {
                id,
                productId: product.id,
                variantId: variant.id,
                productName: product.name,
                productSlug: product.slug,
                imageUrl: variant.imageUrl || product.images[0]?.url || '',
                size: variant.size,
                color: variant.color,
                unitPrice: variant.price,
                quantity: Math.min(quantity, variant.stockQuantity),
                availableStock: variant.stockQuantity,
                selected: true,
              },
            ],
          };
        }),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity: Math.max(1, Math.min(quantity, item.availableStock ?? quantity)),
                }
              : item,
          ),
        })),
      syncProduct: (product) => set((state) => {
        let changed = false;
        const items = state.items.map((item) => {
          if (item.productId !== product.id) return item;
          const variant = product.variants.find((entry) => entry.id === item.variantId);
          if (!variant) return item;
          const imageUrl = variant.imageUrl || product.images[0]?.url || item.imageUrl;
          if (item.unitPrice === variant.price && item.imageUrl === imageUrl
              && item.availableStock === variant.stockQuantity) return item;
          changed = true;
          return { ...item, unitPrice: variant.price, imageUrl,
            availableStock: variant.stockQuantity };
        });
        return changed ? { items } : state;
      }),
      toggle: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, selected: !item.selected } : item,
          ),
        })),
      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      removeSelected: () =>
        set((state) => ({ items: state.items.filter((item) => !item.selected) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'fashionhub_cart',
      merge: (persisted, current) => {
        const saved = persisted as Partial<CartState> | undefined;
        return { ...current, ...saved, items: consolidateCartItems(saved?.items ?? []) };
      },
    },
  ),
);
