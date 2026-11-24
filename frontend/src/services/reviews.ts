import type { ApiResponse, PageResponse, ProductReview, ReviewEligibility, ReviewPage } from '../types/models';
import { httpClient, useDbCatalog } from './httpClient';
import { getMockOrders, syncMockOrdersFromDevServer } from './orders';
import { useAuthStore } from '../stores/authStore';
import { readLocal, writeLocal } from './storage';
import { getMockProducts, saveMockProducts } from './catalog';

const mockKey = 'fashionhub_reviews';
const mockReviews = () => readLocal<ProductReview[]>(mockKey, []);
function saveMockReviews(reviews: ProductReview[]) {
  writeLocal(mockKey, reviews);
  const products = getMockProducts();
  const reviewedProductIds = new Set(reviews.map((review) => review.productId));
  saveMockProducts(products.map((product) => {
    if (!reviewedProductIds.has(product.id)) return product;
    const visible = reviews.filter((review) => review.productId === product.id && review.status !== 'HIDDEN');
    return { ...product, reviewCount: visible.length,
      ratingAverage: visible.length ? Math.round(visible.reduce((sum, review) => sum + review.rating, 0) / visible.length * 100) / 100 : 0 };
  }));
}
function validateDraft(draft: ReviewDraft) {
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) throw new Error('Vui lòng chọn từ 1 đến 5 sao.');
  if (draft.content.trim().length < 10 || draft.content.trim().length > 2000) throw new Error('Nhận xét cần từ 10 đến 2.000 ký tự.');
  if (draft.imageUrls.length > 5) throw new Error('Tối đa 5 ảnh cho mỗi đánh giá.');
}
async function mockPurchase(orderItemId: string) {
  await syncMockOrdersFromDevServer();
  const user = useAuthStore.getState().user;
  const order = getMockOrders().find((entry) => entry.userId === user?.id && entry.items.some((item) => item.id === orderItemId));
  if (!order) throw new Error('Không tìm thấy sản phẩm trong đơn hàng của bạn.');
  const item = order.items.find((entry) => entry.id === orderItemId)!;
  const deliveredAt = [...order.history].reverse().find((entry) => entry.status === 'DELIVERED')?.at ?? order.updatedAt;
  const deadline = new Date(new Date(deliveredAt).getTime() + 30 * 86400000).toISOString();
  return { order, item, deadline, eligible: order.status === 'DELIVERED' && Date.now() <= new Date(deadline).getTime() };
}

export interface ReviewDraft {
  orderItemId?: string;
  rating: number;
  content: string;
  imageUrls: string[];
}

export const reviewService = {
  async product(productId: string, page = 1, rating?: number, withImages = false): Promise<ReviewPage> {
    if (!useDbCatalog) {
      const all = mockReviews().filter((review) => review.productId === productId && review.status !== 'HIDDEN');
      const starCounts = Object.fromEntries([1, 2, 3, 4, 5].map((star) => [String(star), all.filter((review) => review.rating === star).length]));
      const filtered = all.filter((review) => (rating == null || review.rating === rating) && (!withImages || review.images.length > 0));
      const size = 10;
      return { content: filtered.slice((page - 1) * size, page * size), page, size, totalElements: filtered.length,
        totalPages: Math.ceil(filtered.length / size), last: page * size >= filtered.length, starCounts };
    }
    const { data } = await httpClient.get<ApiResponse<ReviewPage>>(`/reviews/product/${productId}`, {
      params: { page, rating, withImages },
    });
    return data.data;
  },
  async mine(orderId: string): Promise<ProductReview[]> {
    if (!useDbCatalog) return mockReviews().filter((review) => review.orderId === orderId &&
      getMockOrders().some((order) => order.id === orderId && order.userId === useAuthStore.getState().user?.id));
    const { data } = await httpClient.get<ApiResponse<ProductReview[]>>('/reviews/my', { params: { orderId } });
    return data.data;
  },
  async eligibility(orderItemId: string): Promise<ReviewEligibility> {
    if (!useDbCatalog) {
      const purchase = await mockPurchase(orderItemId);
      const review = mockReviews().find((entry) => entry.orderItemId === orderItemId);
      return { eligible: purchase.eligible && !review, deadline: purchase.deadline,
        review: review ? { ...review, canEdit: !review.editCount && Date.now() <= new Date(review.createdAt).getTime() + 30 * 86400000 } : null };
    }
    const { data } = await httpClient.get<ApiResponse<ReviewEligibility>>(`/reviews/eligibility/${orderItemId}`);
    return data.data;
  },
  async create(draft: ReviewDraft): Promise<ProductReview> {
    if (!useDbCatalog) {
      validateDraft(draft);
      if (!draft.orderItemId) throw new Error('Thiếu sản phẩm cần đánh giá.');
      const purchase = await mockPurchase(draft.orderItemId);
      if (!purchase.eligible) throw new Error('Chỉ được đánh giá trong 30 ngày sau khi giao hàng.');
      const reviews = mockReviews();
      if (reviews.some((entry) => entry.orderItemId === draft.orderItemId)) throw new Error('Sản phẩm này đã được đánh giá.');
      const now = new Date().toISOString();
      const review: ProductReview = { id: crypto.randomUUID(), productId: purchase.item.productId,
        orderId: purchase.order.id, orderItemId: purchase.item.id,
        reviewerName: 'Khách mua hàng', verifiedPurchase: true, variantId: purchase.item.variantId,
        size: purchase.item.size, color: purchase.item.color, rating: draft.rating, content: draft.content.trim(),
        images: draft.imageUrls, createdAt: now, updatedAt: now, editCount: 0, canEdit: true, status: 'VISIBLE' };
      saveMockReviews([review, ...reviews]);
      return review;
    }
    const { data } = await httpClient.post<ApiResponse<ProductReview>>('/reviews', draft);
    return data.data;
  },
  async edit(id: string, draft: ReviewDraft): Promise<ProductReview> {
    if (!useDbCatalog) {
      validateDraft(draft);
      const reviews = mockReviews();
      const current = reviews.find((entry) => entry.id === id);
      if (!current?.orderItemId) throw new Error('Không tìm thấy đánh giá.');
      await mockPurchase(current.orderItemId);
      if (current.editCount || Date.now() > new Date(current.createdAt).getTime() + 30 * 86400000)
        throw new Error('Đánh giá chỉ được chỉnh sửa một lần trong 30 ngày.');
      const updated = { ...current, rating: draft.rating, content: draft.content.trim(), images: draft.imageUrls,
        updatedAt: new Date().toISOString(), editCount: 1, canEdit: false };
      saveMockReviews(reviews.map((entry) => entry.id === id ? updated : entry));
      return updated;
    }
    const { data } = await httpClient.put<ApiResponse<ProductReview>>(`/reviews/${id}`, draft);
    return data.data;
  },
  async adminList(page = 1): Promise<PageResponse<ProductReview>> {
    if (!useDbCatalog) {
      const content = mockReviews().slice((page - 1) * 50, page * 50);
      return { content, page, size: 50, totalElements: mockReviews().length,
        totalPages: Math.ceil(mockReviews().length / 50), last: page * 50 >= mockReviews().length };
    }
    const { data } = await httpClient.get<ApiResponse<PageResponse<ProductReview>>>('/reviews/admin', { params: { page } });
    return data.data;
  },
  async setVisibility(id: string, visible: boolean): Promise<void> {
    if (!useDbCatalog) {
      saveMockReviews(mockReviews().map((review) => review.id === id ? { ...review, status: visible ? 'VISIBLE' : 'HIDDEN' } : review));
      return;
    }
    await httpClient.patch(`/reviews/admin/${id}/visibility`, { visible });
  },
  async reply(id: string, content: string): Promise<void> {
    if (!useDbCatalog) {
      saveMockReviews(mockReviews().map((review) => review.id === id ? { ...review, sellerReply: content } : review));
      return;
    }
    await httpClient.put(`/reviews/admin/${id}/reply`, { content });
  },
};
