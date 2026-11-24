export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}
export interface HomeBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  buttonLabel: string;
  sortOrder: number;
  isActive: boolean;
}
export interface HomeCategoryShowcase {
  id: string;
  categoryId: string;
  title: string;
  subtitle?: string;
  selectionMode: 'ALL' | 'CUSTOM';
  productIds?: string[];
  products?: Product[];
  displayLimit: number;
  sortOrder: number;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
export interface InAppNotification {
  id: string;
  orderId: string | null;
  subject: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
}
export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  colorCode?: string;
  size: string;
  price: number;
  basePrice?: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  imageUrl?: string;
  images?: ProductImage[];
  isActive?: boolean;
}
export type PromotionTargetType = 'ALL' | 'CATEGORY' | 'PRODUCT';

export interface ProductPromotion {
  id: string;
  name: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
  state?: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'DISABLED';
  targetType?: PromotionTargetType;
  categoryIds?: string[];
  productIds?: string[];
  excludedProductIds?: string[];
  appliedCount?: number;
  createdAt?: string;
  productId?: string;
  productName?: string;
}
export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  brand?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  minPrice: number;
  maxPrice: number;
  originalPrice?: number;
  promotion?: ProductPromotion | null;
  ratingAverage: number;
  reviewCount: number;
  soldCount: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string | null;
  isActive: boolean;
}
export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED';
  createdAt: string;
}
export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  imageUrl: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  availableStock?: number;
  selected: boolean;
}
export interface Address {
  id?: string;
  recipientName: string;
  phone: string;
  province: string;
  district?: string | null;
  ward: string;
  detail: string;
  isDefault?: boolean;
}
export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug?: string;
  sku: string;
  imageUrl: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}
export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'COD' | 'MOCK_PAYMENT';
  status: OrderStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
  history: { status: OrderStatus; at: string }[];
}
export interface ChatSource {
  documentId: string;
  citation?: string;
  title: string;
  excerpt?: string;
  relevanceScore?: number;
  url?: string;
  imageUrl?: string;
}
export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  answerOrigin?: 'MODEL' | 'RULE' | 'NO_RESULTS' | 'PRODUCT_NEEDED' | 'UNSUPPORTED_FEATURE';
  provider?: string | null;
  requestedModel?: string | null;
  sources?: ChatSource[];
  suggestedProductIds?: string[];
  createdAt: string;
}
export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  status: 'INDEXED' | 'PENDING' | 'FAILED';
  isActive?: boolean;
  lastError?: string | null;
  indexedAt?: string | null;
  createdAt?: string;
  chunkCount?: number;
  updatedAt: string;
}
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
export interface ProductReview {
  id: string;
  productId: string;
  productName?: string;
  orderId?: string;
  orderItemId?: string;
  reviewerName: string;
  verifiedPurchase: boolean;
  variantId?: string;
  size?: string;
  color?: string;
  rating: number;
  content: string;
  images: string[];
  sellerReply?: string | null;
  createdAt: string;
  updatedAt: string;
  editCount?: number;
  canEdit?: boolean;
  status?: 'VISIBLE' | 'HIDDEN';
}
export interface ReviewEligibility {
  eligible: boolean;
  deadline?: string | null;
  review?: ProductReview | null;
}
export interface ReviewPage extends PageResponse<ProductReview> {
  starCounts: Record<string, number>;
}
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}
export interface ProductQuery {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  color?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
