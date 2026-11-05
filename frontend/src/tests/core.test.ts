import { beforeEach, describe, expect, it } from 'vitest';
import { seedProducts } from '../mocks/catalog';
import { categoryService, productService } from '../services/catalog';
import { orderService } from '../services/orders';
import { useCartStore } from '../stores/cartStore';
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
    const page = await productService.list({ category: 'ao-nu', maxPrice: 300000, limit: 2 });
    expect(page.content).toHaveLength(2);
    expect(page.totalElements).toBeGreaterThanOrEqual(2);
    expect(
      page.content.every((item) => item.categoryId === 'cat-01' && item.minPrice <= 300000),
    ).toBe(true);
  });
  it('caps cart quantity at variant stock', () => {
    const product = seedProducts[1],
      variant = product.variants[0];
    useCartStore.getState().add(product, variant, variant.stockQuantity + 5);
    expect(useCartStore.getState().items[0].quantity).toBe(variant.stockQuantity);
    useCartStore.getState().remove(variant.id);
    expect(useCartStore.getState().items).toHaveLength(0);
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
    await expect(categoryService.remove('cat-01')).rejects.toThrow('đang có sản phẩm');
  });
});
describe('mock checkout', () => {
  it('creates an order using current variant price and decrements stock', async () => {
    const product = seedProducts[1],
      variant = product.variants[0];
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
          availableStock: variant.stockQuantity,
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
    expect(updated.variants[0].stockQuantity).toBe(variant.stockQuantity - 2);
  });
});
