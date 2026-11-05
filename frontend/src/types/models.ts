export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}
export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  colorCode?: string;
  size: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
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
  district: string;
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
  title: string;
  excerpt?: string;
  relevanceScore?: number;
  url?: string;
}
export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: ChatSource[];
  suggestedProductIds?: string[];
  createdAt: string;
}
export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  status: 'INDEXED' | 'PENDING';
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
