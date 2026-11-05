import type { Category, KnowledgeDocument, Order, Product, User } from '../types/models';

export const categories: Category[] = [
  {
    id: 'cat-01',
    name: 'Áo nữ',
    slug: 'ao-nu',
    description: 'Những thiết kế tinh tế cho mọi ngày.',
    isActive: true,
  },
  {
    id: 'cat-02',
    name: 'Đầm & chân váy',
    slug: 'dam-chan-vay',
    description: 'Dịu dàng trong từng chuyển động.',
    isActive: true,
  },
  {
    id: 'cat-03',
    name: 'Áo nam',
    slug: 'ao-nam',
    description: 'Gọn gàng, thoải mái và dễ phối.',
    isActive: true,
  },
  {
    id: 'cat-04',
    name: 'Quần',
    slug: 'quan',
    description: 'Phom dáng đẹp cho ngày năng động.',
    isActive: true,
  },
  {
    id: 'cat-05',
    name: 'Áo khoác',
    slug: 'ao-khoac',
    description: 'Lớp áo hoàn thiện phong cách.',
    isActive: true,
  },
  {
    id: 'cat-06',
    name: 'Phụ kiện',
    slug: 'phu-kien',
    description: 'Điểm nhấn nhỏ, khác biệt lớn.',
    isActive: true,
  },
];

const catalog: [string, string, number, string][] = [
  ['Áo sơ mi linen dáng rộng', 'cat-01', 329000, 'photo-1598554747436-c9293d6a588f'],
  ['Áo blouse cổ vuông', 'cat-01', 289000, 'photo-1554568218-0f1715e72254'],
  ['Áo thun nữ cotton mềm', 'cat-01', 179000, 'photo-1503342217505-b0a15ec3261c'],
  ['Áo kiểu tay phồng', 'cat-01', 319000, 'photo-1564257577-7cadc9aebd50'],
  ['Áo croptop ribbed', 'cat-01', 219000, 'photo-1529139574466-a303027c1d8b'],
  ['Áo polo nữ tối giản', 'cat-01', 259000, 'photo-1551163943-3f6a855d1153'],
  ['Đầm midi hoa nhí', 'cat-02', 549000, 'photo-1515372039744-b8f02a3ae446'],
  ['Đầm suông linen', 'cat-02', 499000, 'photo-1496747611176-843222e1e57c'],
  ['Chân váy chữ A', 'cat-02', 329000, 'photo-1583496661160-fb5886a13d27'],
  ['Đầm cổ vuông thanh lịch', 'cat-02', 589000, 'photo-1595777457583-95e059d581b8'],
  ['Chân váy xếp ly', 'cat-02', 369000, 'photo-1503341455253-b2e723bb3dbb'],
  ['Đầm maxi mùa hè', 'cat-02', 639000, 'photo-1525507119028-ed4c629a60a3'],
  ['Áo thun nam basic', 'cat-03', 199000, 'photo-1521572163474-6864f9cf17ab'],
  ['Sơ mi nam Oxford', 'cat-03', 399000, 'photo-1598032895397-b9472444bf93'],
  ['Áo polo nam cổ bẻ', 'cat-03', 329000, 'photo-1620012253295-c15cc3e65df4'],
  ['Áo sơ mi linen nam', 'cat-03', 429000, 'photo-1603252109303-2751441dd157'],
  ['Áo thun graphic', 'cat-03', 259000, 'photo-1503341504253-dff4815485f1'],
  ['Áo dài tay waffle', 'cat-03', 349000, 'photo-1617127365659-c47fa864d8bc'],
  ['Quần jean ống suông', 'cat-04', 499000, 'photo-1542272604-787c3835535d'],
  ['Quần tây ống đứng', 'cat-04', 459000, 'photo-1594633312681-425c7b97ccd1'],
  ['Quần short kaki', 'cat-04', 299000, 'photo-1591195853828-11db59a44f6b'],
  ['Quần jean xanh cổ điển', 'cat-04', 529000, 'photo-1541099649105-f69ad21f3246'],
  ['Quần culottes linen', 'cat-04', 419000, 'photo-1591047139829-d91aecb6caea'],
  ['Quần jogger năng động', 'cat-04', 389000, 'photo-1517438476312-10d79c077509'],
  ['Blazer dáng rộng', 'cat-05', 899000, 'photo-1591047139829-d91aecb6caea'],
  ['Áo khoác denim', 'cat-05', 759000, 'photo-1544923246-77307dd654cb'],
  ['Cardigan dệt kim', 'cat-05', 619000, 'photo-1434389677669-e08b4cac3105'],
  ['Áo khoác bomber', 'cat-05', 799000, 'photo-1551028719-00167b16eac5'],
  ['Áo gió chống nắng', 'cat-05', 579000, 'photo-1544022613-e87ca75a784a'],
  ['Áo khoác trench ngắn', 'cat-05', 949000, 'photo-1539533018447-63fcce2678e3'],
  ['Túi đeo vai mini', 'cat-06', 449000, 'photo-1547949003-9792a18a2601'],
  ['Mũ bucket canvas', 'cat-06', 229000, 'photo-1521369909029-2afed882baee'],
  ['Thắt lưng da tối giản', 'cat-06', 299000, 'photo-1624222247344-550fb60583dc'],
  ['Túi tote hằng ngày', 'cat-06', 279000, 'photo-1590874103328-eac38a683ce7'],
  ['Khăn lụa họa tiết', 'cat-06', 359000, 'photo-1606760227091-3dd870d97f1d'],
  ['Mũ lưỡi trai basic', 'cat-06', 199000, 'photo-1588850561407-ed78c282e89b'],
];

export const seedProducts: Product[] = catalog.map(([name, categoryId, price, photo], index) => {
  const id = `prod-${String(index + 1).padStart(3, '0')}`;
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const image = `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=80`;
  const colors =
    index % 2
      ? [
          ['Kem', '#e6d8c3'],
          ['Đen', '#292929'],
        ]
      : [
          ['Trắng', '#f3f0e9'],
          ['Xanh', '#7893a5'],
        ];
  const sizes = categoryId === 'cat-06' ? ['Một cỡ'] : ['S', 'M', 'L'];
  const variants = colors.flatMap(([color, colorCode], ci) =>
    sizes.map((size, si) => ({
      id: `${id}-${ci}-${si}`,
      sku: `FH-${String(index + 1).padStart(3, '0')}-${ci}-${size}`,
      color,
      colorCode,
      size,
      price,
      stockQuantity: index % 13 === 0 ? 0 : index % 9 === 0 ? 2 : 8 + ((index * 7 + si) % 28),
      imageUrl: image,
    })),
  );
  const alternatePhoto = catalog[Math.floor(index / 6) * 6 + ((index + 1) % 6)][3];
  return {
    id,
    slug,
    name,
    description: `${name} từ bộ sưu tập Everyday Edit của FashionHub. Chất liệu dễ chịu, phom dáng được chăm chút để bạn tự tin mặc đẹp mỗi ngày.`,
    categoryId,
    brand: 'FashionHub',
    images: [
      { id: `${id}-image`, url: image, alt: name, isPrimary: true },
      {
        id: `${id}-image-2`,
        url: `https://images.unsplash.com/${alternatePhoto}?auto=format&fit=crop&w=900&q=80`,
        alt: `${name} — góc nhìn tham khảo`,
        isPrimary: false,
      },
    ],
    variants,
    minPrice: price,
    maxPrice: price,
    originalPrice: Math.ceil((price * 1.24) / 1000) * 1000,
    ratingAverage: Number((4.3 + (index % 7) / 10).toFixed(1)),
    reviewCount: 24 + index * 3,
    soldCount: 60 + index * 17,
    status: 'ACTIVE',
    createdAt: new Date(Date.UTC(2026, 9, (index % 28) + 1)).toISOString(),
    updatedAt: '2026-11-01T08:00:00Z',
  };
});

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
      'Phí vận chuyển dự kiến 30.000đ. Đơn từ 500.000đ được miễn phí giao hàng trong mock mode. Thời gian giao hàng tham khảo 2–5 ngày.',
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
    const product = seedProducts[index + 2];
    return {
      id: `order-demo-${index + 1}`,
      orderCode: `FH-2026110${index + 1}`,
      userId: 'user-demo',
      items: [
        {
          id: `item-${index}`,
          productId: product.id,
          variantId: product.variants[1].id,
          productName: product.name,
          sku: product.variants[1].sku,
          imageUrl: product.images[0].url,
          size: product.variants[1].size,
          color: product.variants[1].color,
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
      shippingFee: product.minPrice >= 500000 ? 0 : 30000,
      discountAmount: 0,
      totalAmount: product.minPrice + (product.minPrice >= 500000 ? 0 : 30000),
      paymentMethod: 'COD',
      status: status as Order['status'],
      createdAt: `2026-11-0${index + 1}T08:00:00Z`,
      updatedAt: `2026-11-0${index + 1}T08:00:00Z`,
      history: [{ status: status as Order['status'], at: `2026-11-0${index + 1}T08:00:00Z` }],
    };
  },
);
