import { beforeEach, describe, expect, it } from 'vitest';
import { seedOrders, demoUsers } from '../mocks/catalog';
import { reviewService } from '../services/reviews';
import { useAuthStore } from '../stores/authStore';

describe('Đánh giá sau khi mua hàng', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: demoUsers[0], ready: true });
    const delivered = { ...seedOrders[0], updatedAt: new Date().toISOString(),
      history: [{ status: 'DELIVERED' as const, at: new Date().toISOString() }] };
    localStorage.setItem('fashionhub_orders', JSON.stringify([delivered, seedOrders[2]]));
  });

  it('chỉ cho chủ đơn đánh giá sản phẩm đã giao, mỗi dòng một lần', async () => {
    const deliveredItem = seedOrders[0].items[0];
    const pendingItem = seedOrders[2].items[0];
    await expect(reviewService.create({ orderItemId: pendingItem.id, rating: 5,
      content: 'Chất liệu đẹp và giao hàng nhanh.', imageUrls: [] })).rejects.toThrow();
    const created = await reviewService.create({ orderItemId: deliveredItem.id, rating: 5,
      content: 'Chất liệu đẹp và giao hàng nhanh.', imageUrls: [] });
    expect(created.verifiedPurchase).toBe(true);
    await expect(reviewService.create({ orderItemId: deliveredItem.id, rating: 4,
      content: 'Sản phẩm rất phù hợp.', imageUrls: [] })).rejects.toThrow();
    expect((await reviewService.product(deliveredItem.productId)).totalElements).toBe(1);
  });

  it('cho sửa một lần và chặn lần sửa tiếp theo', async () => {
    const item = seedOrders[0].items[0];
    const created = await reviewService.create({ orderItemId: item.id, rating: 3,
      content: 'Chất lượng khá ổn.', imageUrls: [] });
    const edited = await reviewService.edit(created.id, { rating: 5,
      content: 'Sau khi dùng thấy sản phẩm rất tốt.', imageUrls: [] });
    expect(edited.rating).toBe(5);
    await expect(reviewService.edit(created.id, { rating: 4,
      content: 'Muốn sửa thêm lần nữa.', imageUrls: [] })).rejects.toThrow();
  });
});
