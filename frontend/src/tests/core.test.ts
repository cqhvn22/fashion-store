import { beforeEach, describe, expect, it } from 'vitest';
import { seedProducts } from '../mocks/catalog';
import { categoryService, getMockCategories, productService } from '../services/catalog';
import { orderService } from '../services/orders';
import { consolidateCartItems, useCartStore } from '../stores/cartStore';
import { readCheckoutDraft, saveCheckoutDraft } from '../services/checkoutDraft';
import { cartSubtotal, formatCurrency } from '../utils/format';

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ items: [] });
});
describe('catalog and cart', () => {
  it('formats whole VND amounts', () => {
    expect(formatCurrency(199000)).toContain('199.000');
  });
  it('filters catalog and returns consistent pagination', async () => {
    const page = await productService.list({ category: 'ao-phong', maxPrice: 300000, limit: 2 });
    expect(page.content).toHaveLength(2);
    expect(page.totalElements).toBeGreaterThanOrEqual(2);
    expect(
      page.content.every((item) => item.categoryId === 'cat-atino-ao-phong' && item.minPrice <= 300000),
    ).toBe(true);
  });
  it('includes products from nested categories', async () => {
    const page = await productService.list({ category: 'ao-khoac', limit: 100 });
    expect(page.content.some((item) => item.categoryId === 'cat-atino-ao-gio')).toBe(true);
    expect(page.content.some((item) => item.categoryId === 'cat-atino-ao-jacket')).toBe(true);
  });
  it('caps cart quantity at variant stock', () => {
    const product = seedProducts[1],
      variant = product.variants[0];
    useCartStore.getState().add(product, variant, variant.stockQuantity + 5);
    expect(useCartStore.getState().items[0].quantity).toBe(variant.stockQuantity);
    useCartStore.getState().remove(variant.id);
    expect(useCartStore.getState().items).toHaveLength(0);
  });
  it('groups the same variant into one cart row', () => {
    const product = seedProducts[1], variant = product.variants[0];
    useCartStore.getState().add(product, variant, 1);
    useCartStore.getState().add(product, variant, 2);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);

    const duplicate = { ...useCartStore.getState().items[0], id: 'old-row', quantity: 1 };
    expect(consolidateCartItems([...useCartStore.getState().items, duplicate])).toHaveLength(1);
  });
  it('totals selected cart items only', () => {
    expect(
      cartSubtotal([
        { unitPrice: 100000, quantity: 2, selected: true },
        { unitPrice: 50000, quantity: 3, selected: false },
      ]),
    ).toBe(200000);
  });
  it('keeps product categories consistent when deleting', async () => {
    await expect(categoryService.remove('cat-03')).rejects.toThrow('đang có danh mục con');
    await expect(categoryService.remove('cat-atino-ao-phong')).rejects.toThrow('đang có sản phẩm');
  });
  it('resets catalog to fresh dataset if dataset version is outdated', () => {
    localStorage.setItem('fashionhub_catalog_dataset_version', 'legacy-v1');
    localStorage.setItem('fashionhub_categories', JSON.stringify([{ id: 'old-cat', name: 'Old' }]));
    expect(getMockCategories().some((item) => item.id === 'cat-atino-ao-gio')).toBe(true);
    expect(getMockCategories().filter((item) => item.id === 'cat-atino-ao-gio')).toHaveLength(1);
  });
});
describe('checkout draft', () => {
  it('restores shipping information only for the same user', () => {
    const draft = {
      recipientName: 'Demo User', phone: '0901234567', province: 'Hà Nội',
      district: 'Ba Đình', ward: 'Ngọc Hà', detail: '12 Hoàng Hoa Thám', note: 'Giao buổi chiều',
    };
    saveCheckoutDraft('user-one', draft);
    expect(readCheckoutDraft('user-one')).toEqual(draft);
    expect(readCheckoutDraft('user-two')).toBeNull();
  });
});
describe('mock checkout', () => {
  it('creates an order using current variant price and decrements stock', async () => {
    const product = await productService.byId(seedProducts[1].id);
    const variant = product.variants[0];
    const initialStock = variant.stockQuantity;
    const order = await orderService.create({
      userId: 'user-demo',
      items: [
        {
          id: variant.id,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productSlug: product.slug,
          imageUrl: product.images[0].url,
          size: variant.size,
          color: variant.color,
          unitPrice: 1,
          quantity: 2,
          availableStock: initialStock,
          selected: true,
        },
      ],
      address: {
        recipientName: 'Demo User',
        phone: '0901234567',
        province: 'Hà Nội',
        district: 'Ba Đình',
        ward: 'Ngọc Hà',
        detail: '12 Hoàng Hoa Thám',
      },
    });
    expect(order.status).toBe('PENDING');
    expect(order.subtotal).toBe(variant.price * 2);
    const updated = await productService.byId(product.id);
    expect(updated.variants[0].stockQuantity).toBe(initialStock - 2);
  });
});
