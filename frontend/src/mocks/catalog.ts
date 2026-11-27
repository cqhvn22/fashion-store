import type { Category, KnowledgeDocument, Order, Product, User } from '../types/models';
import { atinoCategories, atinoProducts } from '../data/atinoCatalog';

export const rootCategories: Category[] = [
  {
    id: 'cat-03',
    name: 'Áo nam',
    slug: 'ao-nam',
    description: 'Áo nam phong cách, đa dạng kiểu dáng từ áo phông, polo đến sơ mi.',
    imageUrl: '/images/products/ao-phong-loose-l.3.2774-p37936799_1.jpg',
    isActive: true,
  },
  {
    id: 'cat-04',
    name: 'Quần',
    slug: 'quan',
    description: 'Quần nam phom dáng chuẩn, thoải mái vận động và tôn dáng.',
    imageUrl: '/images/products/quan-jeans-loose-30.1.1364-p37937898_1.jpg',
    isActive: true,
  },
  {
    id: 'cat-05',
    name: 'Áo khoác',
    slug: 'ao-khoac',
    description: 'Áo khoác nam cản gió, giữ ấm và hoàn thiện phong cách.',
    imageUrl: '/images/products/ao-khoac-gio-regular-2xl.3.8824-p37939993_1.jpg',
    isActive: true,
  },
  {
    id: 'cat-06',
    name: 'Phụ kiện',
    slug: 'phu-kien',
    description: 'Phụ kiện thời trang nam: giày dép, túi chéo, dây lưng, tất, mũ.',
    imageUrl: '/images/products/tat-khong-co-5.9601-p37409998_1.jpg',
    isActive: true,
  },
];

export const categories: Category[] = [
  ...rootCategories,
  ...atinoCategories,
];

export const seedProducts: Product[] = atinoProducts;

export const demoUsers: User[] = [
  {
    id: 'user-demo',
    fullName: 'Nguyễn Minh Anh',
    email: 'user@fashionhub.vn',
    phone: '0901234567',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-09-01T08:00:00Z',
  },
  {
    id: 'admin-demo',
    fullName: 'Quản trị FashionHub',
    email: 'admin@fashionhub.vn',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-08-01T08:00:00Z',
  },
];

export const seedKnowledge: KnowledgeDocument[] = [
  {
    id: 'doc-size',
    title: 'Hướng dẫn chọn size',
    content:
      'Size S phù hợp 45–52 kg, M phù hợp 53–62 kg, L phù hợp 63–72 kg. Nên so số đo thực tế để chọn vừa nhất.',
    status: 'INDEXED',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'doc-shipping',
    title: 'Chính sách giao hàng',
    content:
      'Phí vận chuyển dự kiến 30.000đ. Đơn từ 499.000đ được miễn phí giao hàng trong mock mode. Thời gian giao hàng tham khảo 2–5 ngày.',
    status: 'INDEXED',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'doc-returns',
    title: 'Chính sách đổi trả',
    content:
      'Hỗ trợ đổi size trong 7 ngày kể từ khi nhận hàng nếu sản phẩm còn nguyên tem và chưa qua sử dụng.',
    status: 'INDEXED',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'doc-material',
    title: 'Chất liệu và bảo quản',
    content:
      'Giặt nhẹ với nước mát, lộn trái sản phẩm và phơi nơi thoáng mát để giữ màu và phom dáng.',
    status: 'INDEXED',
    updatedAt: '2026-11-01T08:00:00Z',
  },
];

export const seedOrders: Order[] = ['DELIVERED', 'SHIPPING', 'PENDING', 'CONFIRMED'].map(
  (status, index) => {
    const product = seedProducts[index % seedProducts.length];
    const variant = product.variants[0];
    return {
      id: `order-demo-${index + 1}`,
      orderCode: `FH-2026110${index + 1}`,
      userId: 'user-demo',
      items: [
        {
          id: `item-${index}`,
          productId: product.id,
          productSlug: product.slug,
          variantId: variant.id,
          productName: product.name,
          sku: variant.sku,
          imageUrl: variant.imageUrl || product.images[0].url,
          size: variant.size,
          color: variant.color,
          unitPrice: product.minPrice,
          quantity: 1,
          lineTotal: product.minPrice,
        },
      ],
      shippingAddress: {
        recipientName: 'Nguyễn Minh Anh',
        phone: '0901234567',
        province: 'TP. Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        detail: '12 Nguyễn Huệ',
      },
      subtotal: product.minPrice,
      shippingFee: product.minPrice >= 499000 ? 0 : 30000,
      discountAmount: 0,
      totalAmount: product.minPrice + (product.minPrice >= 499000 ? 0 : 30000),
      paymentMethod: 'COD',
      status: status as Order['status'],
      createdAt: `2026-11-0${index + 1}T08:00:00Z`,
      updatedAt: `2026-11-0${index + 1}T08:00:00Z`,
      history: [{ status: status as Order['status'], at: `2026-11-0${index + 1}T08:00:00Z` }],
    };
  },
);
