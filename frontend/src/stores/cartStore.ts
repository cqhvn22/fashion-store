import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductVariant } from '../types/models';
interface CartState {
  items: CartItem[];
  add: (product: Product, variant: ProductVariant, quantity: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  removeSelected: () => void;
  clear: () => void;
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
                imageUrl: product.images[0]?.url ?? '',
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
    { name: 'fashionhub_cart' },
  ),
);
