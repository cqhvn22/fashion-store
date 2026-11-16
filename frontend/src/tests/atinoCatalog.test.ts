import { describe, expect, it } from 'vitest';
import { getMockCategories, getMockProducts, productService } from '../services/catalog';
import { atinoCategories, atinoProducts } from '../data/atinoCatalog';

describe('Bộ dữ liệu sản phẩm ATINO', () => {
  it('đã nạp đủ 280 sản phẩm và 21 danh mục từ Atino', () => {
    expect(atinoProducts).toHaveLength(280);
    expect(atinoCategories).toHaveLength(21);

    const categories = getMockCategories();
    for (const cat of atinoCategories) {
      expect(categories.some((c) => c.id === cat.id && c.slug === cat.slug)).toBe(true);
    }

    const products = getMockProducts();
    expect(products.length).toBeGreaterThanOrEqual(280);
    const atinoCount = products.filter((p) => p.brand === 'ATINO').length;
    expect(atinoCount).toBe(280);
  });

  it('toàn bộ sản phẩm Atino đều có hình ảnh và biến thể hợp lệ', () => {
    for (const p of atinoProducts) {
      expect(p.images.length).toBeGreaterThan(0);
      expect(p.images[0].url).toMatch(/^\/images\/products\//);
      expect(p.variants.length).toBeGreaterThan(0);
      expect(p.minPrice).toBeGreaterThan(0);
      expect(p.slug).toBeTruthy();

      for (const v of p.variants) {
        expect(v.sku).toBeTruthy();
        expect(v.color).toBeTruthy();
        expect(v.size).toBeTruthy();
        expect(v.price).toBe(p.minPrice);
        expect(v.imageUrl).toMatch(/^\/images\/products\//);
      }
    }
  });

  it('lọc danh mục sản phẩm Atino hoạt động chuẩn xác', async () => {
    // 1. Áo phông
    const aoPhongRes = await productService.list({ category: 'ao-phong', limit: 100 });
    expect(aoPhongRes.content.length).toBe(74);
    expect(aoPhongRes.content.every((p) => p.categoryId === 'cat-atino-ao-phong')).toBe(true);

    // 2. Áo polo
    const poloRes = await productService.list({ category: 'ao-polo', limit: 100 });
    expect(poloRes.content.length).toBe(43);

    // 3. Quần short
    const shortRes = await productService.list({ category: 'quan-short', limit: 100 });
    expect(shortRes.content.length).toBe(25);

    // 4. Quần jeans
    const jeansRes = await productService.list({ category: 'quan-jeans', limit: 100 });
    expect(jeansRes.content.length).toBe(16);

    // 5. Danh mục cha 'ao-nam' gom tất cả các sản phẩm áo nam con
    const aoNamRes = await productService.list({ category: 'ao-nam', limit: 300 });
    expect(aoNamRes.content.length).toBe(183);
  });
});
