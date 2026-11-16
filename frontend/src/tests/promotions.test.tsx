import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  promotionService,
  PROMOTIONS_KEY,
  PROMOTIONS_MIGRATION_KEY,
} from '../services/promotions';
import { productService, getMockProducts } from '../services/catalog';
import { AdminPromotions } from '../features/admin/AdminPromotions';

describe('Quản lý chương trình giảm giá (Promotions)', () => {
  beforeEach(() => {
    localStorage.setItem(PROMOTIONS_MIGRATION_KEY, 'done');
    localStorage.setItem(PROMOTIONS_KEY, JSON.stringify([]));
    localStorage.removeItem('fashionhub_products');
  });

  it('lưu chương trình giảm giá thành công ở chế độ mock mà không bị lỗi kết nối máy chủ', async () => {
    const products = await productService.listAdmin();
    expect(products.length).toBeGreaterThan(0);
    const targetProduct = products[0];

    const now = Date.now();
    const startsAt = new Date(now - 60000).toISOString(); // 1 phút trước
    const endsAt = new Date(now + 86400000 * 7).toISOString(); // 7 ngày sau

    const saved = await promotionService.save({
      productId: targetProduct.id,
      name: 'Flash sale 10%',
      discountType: 'PERCENT',
      discountValue: 10,
      startsAt,
      endsAt,
      isEnabled: true,
      targetType: 'PRODUCT',
      productIds: [targetProduct.id],
    });

    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe('Flash sale 10%');
    expect(saved.state).toBe('ACTIVE');

    // Kiểm tra danh sách promotions trả về
    const list = await promotionService.list();
    expect(list.some((p) => p.id === saved.id)).toBe(true);

    // Kiểm tra giá sản phẩm đã được giảm 10%
    const updatedProducts = getMockProducts();
    const updated = updatedProducts.find((p) => p.id === targetProduct.id);
    expect(updated).toBeDefined();
    expect(updated?.promotion).toBeDefined();
    expect(updated?.promotion?.name).toBe('Flash sale 10%');
    expect(updated?.originalPrice).toBe(targetProduct.minPrice);
    expect(updated?.minPrice).toBe(Math.floor(targetProduct.minPrice * 0.9));
  });

  it('áp dụng giảm giá cho tất cả sản phẩm thuộc danh mục được chọn', async () => {
    const products = await productService.listAdmin();
    // Tìm các sản phẩm thuộc category cat-atino-ao-phong (Áo phông nam)
    const catProducts = products.filter((p) => p.categoryId === 'cat-atino-ao-phong');
    expect(catProducts.length).toBeGreaterThan(0);

    const now = Date.now();
    const startsAt = new Date(now - 60000).toISOString();
    const endsAt = new Date(now + 86400000 * 7).toISOString();

    await promotionService.save({
      name: 'Ưu đãi Áo Phông 20%',
      discountType: 'PERCENT',
      discountValue: 20,
      startsAt,
      endsAt,
      isEnabled: true,
      targetType: 'CATEGORY',
      categoryIds: ['cat-atino-ao-phong'],
    });

    const updatedProducts = getMockProducts();
    // Toàn bộ sản phẩm thuộc cat-atino-ao-phong phải có promotion và giảm 20%
    for (const p of catProducts) {
      const match = updatedProducts.find((u) => u.id === p.id);
      expect(match?.promotion?.name).toBe('Ưu đãi Áo Phông 20%');
      expect(match?.minPrice).toBe(Math.floor(p.minPrice * 0.8));
      expect(match?.originalPrice).toBe(p.minPrice);
    }

    // Các sản phẩm không thuộc danh mục Áo Phông (như Quần Jeans) không bị ảnh hưởng
    const unrelatedProducts = products.filter((p) => p.categoryId === 'cat-atino-quan-jeans');
    expect(unrelatedProducts.length).toBeGreaterThan(0);
    for (const p of unrelatedProducts) {
      const match = updatedProducts.find((u) => u.id === p.id);
      expect(match?.promotion).toBeNull();
      expect(match?.originalPrice).toBeUndefined();
    }
  });

  it('loại trừ (bỏ) một vài sản phẩm trong danh mục được chọn', async () => {
    const products = await productService.listAdmin();
    const catProducts = products.filter((p) => p.categoryId === 'cat-atino-ao-phong');
    expect(catProducts.length).toBeGreaterThanOrEqual(2);

    const excludedProduct = catProducts[0];
    const includedProduct = catProducts[1];

    const now = Date.now();
    const startsAt = new Date(now - 60000).toISOString();
    const endsAt = new Date(now + 86400000 * 7).toISOString();

    await promotionService.save({
      name: 'Sale Áo Phông trừ sp mới',
      discountType: 'PERCENT',
      discountValue: 15,
      startsAt,
      endsAt,
      isEnabled: true,
      targetType: 'CATEGORY',
      categoryIds: ['cat-atino-ao-phong'],
      excludedProductIds: [excludedProduct.id],
    });

    const updatedProducts = getMockProducts();

    // Sản phẩm bị loại trừ phải giữ nguyên giá gốc, không có promotion
    const excludedMatch = updatedProducts.find((p) => p.id === excludedProduct.id);
    expect(excludedMatch?.promotion).toBeNull();
    expect(excludedMatch?.minPrice).toBe(excludedProduct.minPrice);
    expect(excludedMatch?.originalPrice).toBeUndefined();

    // Sản phẩm còn lại trong danh mục phải được giảm 15%
    const includedMatch = updatedProducts.find((p) => p.id === includedProduct.id);
    expect(includedMatch?.promotion?.name).toBe('Sale Áo Phông trừ sp mới');
    expect(includedMatch?.minPrice).toBe(Math.floor(includedProduct.minPrice * 0.85));
    expect(includedMatch?.originalPrice).toBe(includedProduct.minPrice);
  });

  it('áp dụng giảm giá cho nhiều sản phẩm được chọn', async () => {
    const products = await productService.listAdmin();
    expect(products.length).toBeGreaterThanOrEqual(2);
    const chosen = [products[0], products[1]];

    const now = Date.now();
    const startsAt = new Date(now - 60000).toISOString();
    const endsAt = new Date(now + 86400000 * 7).toISOString();

    await promotionService.save({
      name: 'Combo Hot Sale',
      discountType: 'FIXED',
      discountValue: 30000,
      startsAt,
      endsAt,
      isEnabled: true,
      targetType: 'PRODUCT',
      productIds: [chosen[0].id, chosen[1].id],
    });

    const updatedProducts = getMockProducts();
    for (const p of chosen) {
      const match = updatedProducts.find((u) => u.id === p.id);
      expect(match?.promotion?.name).toBe('Combo Hot Sale');
      expect(match?.minPrice).toBe(p.minPrice - 30000);
    }
  });

  it('từ chối tạo hai chương trình trùng thời gian cho cùng một sản phẩm', async () => {
    const products = await productService.listAdmin();
    const targetProduct = products[0];

    const now = Date.now();
    const startsAt = new Date(now).toISOString();
    const endsAt = new Date(now + 86400000).toISOString();

    await promotionService.save({
      productId: targetProduct.id,
      name: 'Chương trình 1',
      discountType: 'PERCENT',
      discountValue: 10,
      startsAt,
      endsAt,
      isEnabled: true,
      targetType: 'PRODUCT',
      productIds: [targetProduct.id],
    });

    // Thử tạo chương trình thứ 2 trùng thời gian
    await expect(
      promotionService.save({
        productId: targetProduct.id,
        name: 'Chương trình 2',
        discountType: 'PERCENT',
        discountValue: 20,
        startsAt,
        endsAt,
        isEnabled: true,
        targetType: 'PRODUCT',
        productIds: [targetProduct.id],
      })
    ).rejects.toThrow(/khoảng thời gian/i);
  });

  it('hoàn nguyên giá khi tắt chương trình giảm giá', async () => {
    const products = await productService.listAdmin();
    const targetProduct = products[0];
    const originalMinPrice = targetProduct.minPrice;

    const now = Date.now();
    const startsAt = new Date(now - 60000).toISOString();
    const endsAt = new Date(now + 86400000).toISOString();

    const promo = await promotionService.save({
      productId: targetProduct.id,
      name: 'Giảm 50.000',
      discountType: 'FIXED',
      discountValue: 50000,
      startsAt,
      endsAt,
      isEnabled: true,
      targetType: 'PRODUCT',
      productIds: [targetProduct.id],
    });

    let currentProducts = getMockProducts();
    let current = currentProducts.find((p) => p.id === targetProduct.id);
    expect(current?.minPrice).toBe(originalMinPrice - 50000);

    // Tắt chương trình
    await promotionService.save(
      {
        productId: promo.productId,
        name: promo.name,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        isEnabled: false,
        targetType: promo.targetType,
        productIds: promo.productIds,
        categoryIds: promo.categoryIds,
      },
      promo.id
    );

    currentProducts = getMockProducts();
    current = currentProducts.find((p) => p.id === targetProduct.id);
    expect(current?.minPrice).toBe(originalMinPrice);
    expect(current?.promotion).toBeNull();
    expect(current?.originalPrice).toBeUndefined();
  });

  it('hiển thị giao diện AdminPromotions và tạo mới thành công từ modal', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminPromotions />
      </QueryClientProvider>
    );

    // Kiểm tra tiêu đề trang
    expect(await screen.findByRole('heading', { name: 'Chương trình giảm giá', level: 1 })).toBeInTheDocument();

    // Bấm nút tạo chương trình
    const createBtn = screen.getByRole('button', { name: /Tạo chương trình mới/i });
    fireEvent.click(createBtn);

    // Modal xuất hiện
    expect(screen.getByRole('heading', { name: /Tạo chương trình giảm giá/i })).toBeInTheDocument();

    // Điền tên chương trình
    const nameInput = screen.getByPlaceholderText(/Flash Sale Cuối Tuần/i);
    fireEvent.change(nameInput, { target: { value: 'Flash sale' } });

    // Bấm lưu chương trình
    const saveBtn = screen.getByRole('button', { name: /LƯU CHƯƠNG TRÌNH/i });
    fireEvent.click(saveBtn);

    // Sau khi lưu thành công, modal đóng lại và table có chương trình vừa tạo
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Tạo chương trình giảm giá mới/i })).not.toBeInTheDocument();
      expect(screen.getByText('Flash sale')).toBeInTheDocument();
    });
  });
});
