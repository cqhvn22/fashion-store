import type { Category, Product, ProductPromotion, PromotionTargetType } from '../types/models';
import { categories as seedCategories, seedProducts } from '../mocks/catalog';
import { httpClient, useDbCatalog } from './httpClient';
import { broadcastSync, readLocal, writeLocal } from './storage';

const endpoint = '/admin/promotions';
export const PROMOTIONS_KEY = 'fashionhub_promotions';
export const PROMOTIONS_MIGRATION_KEY = 'fashionhub_promotions_seeded_v1';
const PRODUCTS_KEY = 'fashionhub_products';
const CATEGORIES_KEY = 'fashionhub_categories';

export interface PromotionInput {
  name: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
  targetType?: PromotionTargetType;
  categoryIds?: string[];
  productIds?: string[];
  excludedProductIds?: string[];
  productId?: string; // backwards compatibility
}

export const defaultPromotions: ProductPromotion[] = [
  {
    id: 'promo-demo-quan',
    name: 'Flash Sale Quần Nam',
    discountType: 'PERCENT',
    discountValue: 15,
    startsAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    endsAt: new Date(Date.now() + 3600000 * 24 * 28).toISOString(),
    isEnabled: true,
    targetType: 'CATEGORY',
    categoryIds: ['cat-04'], // Quần
    productIds: [],
    excludedProductIds: [],
  },
  {
    id: 'promo-demo-ao-nam',
    name: 'Ưu đãi Áo Nam',
    discountType: 'PERCENT',
    discountValue: 10,
    startsAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    endsAt: new Date(Date.now() + 3600000 * 24 * 27).toISOString(),
    isEnabled: true,
    targetType: 'CATEGORY',
    categoryIds: ['cat-03'], // Áo nam
    productIds: [],
    excludedProductIds: [],
  },
  {
    id: 'promo-demo-phu-kien',
    name: 'Xả kho Phụ Kiện',
    discountType: 'FIXED',
    discountValue: 30000,
    startsAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
    endsAt: new Date(Date.now() + 3600000 * 24 * 14).toISOString(),
    isEnabled: true,
    targetType: 'CATEGORY',
    categoryIds: ['cat-06'], // Phụ kiện
    productIds: [],
    excludedProductIds: [],
  },
];

export function computePromotionState(promo: {
  isEnabled: boolean;
  startsAt: string;
  endsAt: string;
}): 'ACTIVE' | 'SCHEDULED' | 'ENDED' | 'DISABLED' {
  if (!promo.isEnabled) return 'DISABLED';
  const now = Date.now();
  const start = new Date(promo.startsAt).getTime();
  const end = new Date(promo.endsAt).getTime();
  if (start > now) return 'SCHEDULED';
  if (end <= now) return 'ENDED';
  return 'ACTIVE';
}

function getStoredMockProducts(): Product[] {
  return readLocal<Product[]>(PRODUCTS_KEY, seedProducts);
}

function saveStoredMockProducts(products: Product[]) {
  writeLocal(PRODUCTS_KEY, products);
}

function getStoredMockCategories(): Category[] {
  return readLocal<Category[]>(CATEGORIES_KEY, seedCategories);
}

export function isProductEligible(
  product: Product,
  promo: ProductPromotion,
  categories?: Category[]
): boolean {
  // If product is explicitly excluded, it is never eligible
  if (promo.excludedProductIds && promo.excludedProductIds.includes(product.id)) {
    return false;
  }

  const targetType = promo.targetType ?? (promo.productId ? 'PRODUCT' : 'ALL');

  if (targetType === 'ALL') {
    return true;
  }

  if (targetType === 'CATEGORY' && promo.categoryIds && promo.categoryIds.length > 0) {
    if (promo.categoryIds.includes(product.categoryId)) return true;
    if (categories && categories.length > 0) {
      let cur = categories.find((c) => c.id === product.categoryId);
      while (cur?.parentId) {
        if (promo.categoryIds.includes(cur.parentId)) return true;
        cur = categories.find((c) => c.id === cur?.parentId);
      }
    }
    return false;
  }

  if (targetType === 'PRODUCT') {
    if (promo.productIds && promo.productIds.length > 0) {
      return promo.productIds.includes(product.id);
    }
    if (promo.productId) {
      return promo.productId === product.id;
    }
  }

  if (promo.productId) {
    return promo.productId === product.id;
  }

  return false;
}

export function applyPromotionsToProductList(
  products: Product[],
  promotions: ProductPromotion[],
  categories?: Category[]
): Product[] {
  const cats = categories ?? getStoredMockCategories();
  const now = Date.now();

  // Filter only active promotions
  const activePromos = promotions.filter((promo) => {
    if (!promo.isEnabled) return false;
    const start = new Date(promo.startsAt).getTime();
    const end = new Date(promo.endsAt).getTime();
    return start <= now && end > now;
  });

  return products.map((product) => {
    // Find all matching active promotions for this product
    const matchingPromos = activePromos.filter((promo) =>
      isProductEligible(product, promo, cats)
    );

    if (matchingPromos.length > 0) {
      const baselineMin = product.variants.reduce(
        (min, v) => Math.min(min, v.basePrice ?? (v.compareAtPrice ? v.compareAtPrice : v.price)),
        Infinity
      );

      // Pick promo giving highest discount on baselineMin, prioritizing PRODUCT > CATEGORY > ALL if discounts are equal
      let bestPromo = matchingPromos[0];
      let bestDiscount = -1;
      const getSpecificity = (p: ProductPromotion) =>
        p.targetType === 'PRODUCT' ? 2 : p.targetType === 'CATEGORY' ? 1 : 0;

      for (const p of matchingPromos) {
        const discount =
          p.discountType === 'PERCENT'
            ? Math.floor((baselineMin * p.discountValue) / 100)
            : p.discountValue;
        if (
          discount > bestDiscount ||
          (discount === bestDiscount && getSpecificity(p) > getSpecificity(bestPromo))
        ) {
          bestDiscount = discount;
          bestPromo = p;
        }
      }

      const updatedVariants = product.variants.map((v) => {
        const basePrice = v.basePrice ?? (v.compareAtPrice ? v.compareAtPrice : v.price);
        const discounted =
          bestPromo.discountType === 'PERCENT'
            ? Math.max(1000, Math.floor((basePrice * (100 - bestPromo.discountValue)) / 100))
            : Math.max(1000, basePrice - bestPromo.discountValue);
        return {
          ...v,
          basePrice,
          compareAtPrice: basePrice,
          price: discounted,
        };
      });

      const minPrice = Math.min(...updatedVariants.map((v) => v.price));
      const maxPrice = Math.max(...updatedVariants.map((v) => v.price));
      const originalPrice = Math.min(...updatedVariants.map((v) => v.compareAtPrice ?? v.price));

      return {
        ...product,
        variants: updatedVariants,
        minPrice,
        maxPrice,
        originalPrice,
        promotion: {
          ...bestPromo,
          state: 'ACTIVE' as const,
        },
      };
    } else {
      // Revert to original baseline prices
      const updatedVariants = product.variants.map((v) => {
        const basePrice = v.basePrice ?? v.price;
        return {
          ...v,
          basePrice: undefined,
          compareAtPrice: undefined,
          price: basePrice,
        };
      });

      const minPrice = Math.min(...updatedVariants.map((v) => v.price));
      const maxPrice = Math.max(...updatedVariants.map((v) => v.price));

      return {
        ...product,
        variants: updatedVariants,
        minPrice,
        maxPrice,
        originalPrice: undefined,
        promotion: null,
      };
    }
  });
}

export function applyPromotionsToMockProducts(promotions: ProductPromotion[]) {
  const products = getStoredMockProducts();
  const updated = applyPromotionsToProductList(products, promotions);
  saveStoredMockProducts(updated);
  return updated;
}

export function getMockPromotions(): ProductPromotion[] {
  let raw = readLocal<ProductPromotion[]>(PROMOTIONS_KEY, defaultPromotions);

  // Auto-migration: if the user's localStorage was previously initialized without default promotions,
  // ensure missing default demo promotions are safely merged in so they always appear in Admin & Catalog.
  try {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(PROMOTIONS_MIGRATION_KEY)) {
      const existingIds = new Set(raw.map((p) => p.id));
      const missingDefaults = defaultPromotions.filter((d) => !existingIds.has(d.id));
      if (missingDefaults.length > 0) {
        raw = [...raw, ...missingDefaults];
        writeLocal(PROMOTIONS_KEY, raw);
        applyPromotionsToMockProducts(raw);
      }
      localStorage.setItem(PROMOTIONS_MIGRATION_KEY, '1');
    }
  } catch {
    /* ignore storage errors */
  }

  const products = getStoredMockProducts();
  const categories = getStoredMockCategories();
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  return raw
    .map((item) => {
      const eligibleCount = products.filter((p) => isProductEligible(p, item, categories)).length;
      const singleProductId =
        item.productId ||
        (item.targetType === 'PRODUCT' && item.productIds?.length === 1
          ? item.productIds[0]
          : undefined);
      return {
        ...item,
        targetType: item.targetType ?? (item.productId ? 'PRODUCT' : 'ALL'),
        productName: singleProductId ? productMap.get(singleProductId) ?? item.productName : undefined,
        appliedCount: eligibleCount,
        excludedProductIds: item.excludedProductIds ?? [],
        state: computePromotionState(item),
      };
    })
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

export function resetMockPromotionsToDefault(): ProductPromotion[] {
  writeLocal(PROMOTIONS_KEY, defaultPromotions);
  applyPromotionsToMockProducts(defaultPromotions);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PROMOTIONS_MIGRATION_KEY, '1');
    } catch {
      /* ignore */
    }
  }
  return getMockPromotions();
}

export function saveMockPromotion(input: PromotionInput, id?: string): ProductPromotion {
  const currentList = readLocal<ProductPromotion[]>(PROMOTIONS_KEY, defaultPromotions);
  const start = new Date(input.startsAt).getTime();
  const end = new Date(input.endsAt).getTime();

  if (start >= end) {
    throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.');
  }

  const targetType = input.targetType ?? (input.productId ? 'PRODUCT' : 'ALL');
  const productIds = input.productIds ?? (input.productId ? [input.productId] : []);
  const categoryIds = input.categoryIds ?? [];
  const excludedProductIds = input.excludedProductIds ?? [];

  // Check overlap for single-product targeting when enabled
  if (input.isEnabled) {
    const hasOverlap = currentList.some((p) => {
      if (id && p.id === id) return false;
      if (!p.isEnabled) return false;
      const pStart = new Date(p.startsAt).getTime();
      const pEnd = new Date(p.endsAt).getTime();
      const timeOverlaps = start < pEnd && end > pStart;
      if (!timeOverlaps) return false;

      const singleTarget1 =
        input.productId || (targetType === 'PRODUCT' && productIds.length === 1 ? productIds[0] : null);
      const singleTarget2 =
        p.productId ||
        ((p.targetType ?? 'PRODUCT') === 'PRODUCT' && p.productIds?.length === 1 ? p.productIds[0] : null);

      if (singleTarget1 && singleTarget2 && singleTarget1 === singleTarget2) {
        return true;
      }
      return false;
    });

    if (hasOverlap) {
      throw new Error('Đã có chương trình giảm giá khác đang bật cho sản phẩm này trong cùng khoảng thời gian.');
    }
  }

  const promoId =
    id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `promo-${Date.now()}`);
  const products = getStoredMockProducts();
  const singleProductId =
    input.productId || (targetType === 'PRODUCT' && productIds.length === 1 ? productIds[0] : undefined);
  const productName = singleProductId ? products.find((p) => p.id === singleProductId)?.name : undefined;

  const savedItem: ProductPromotion = {
    id: promoId,
    name: input.name.trim(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isEnabled: input.isEnabled,
    targetType,
    categoryIds,
    productIds,
    excludedProductIds,
    productId: singleProductId,
    productName,
    state: computePromotionState(input),
  };

  const nextList = id
    ? currentList.map((item) => (item.id === id ? savedItem : item))
    : [savedItem, ...currentList];

  writeLocal(PROMOTIONS_KEY, nextList);
  applyPromotionsToMockProducts(nextList);

  return savedItem;
}

export const promotionService = {
  async list(): Promise<ProductPromotion[]> {
    if (!useDbCatalog) return getMockPromotions();
    try {
      const { data } = await httpClient.get<{ data: ProductPromotion[] }>(endpoint);
      return data.data;
    } catch {
      return getMockPromotions();
    }
  },

  async save(input: PromotionInput, id?: string): Promise<ProductPromotion> {
    if (!useDbCatalog) return saveMockPromotion(input, id);
    try {
      const { data } = id
        ? await httpClient.put<{ data: ProductPromotion }>(`${endpoint}/${id}`, input)
        : await httpClient.post<{ data: ProductPromotion }>(endpoint, input);
      broadcastSync(PROMOTIONS_KEY);
      return data.data;
    } catch (error) {
      if (error instanceof Error && error.message && !error.message.includes('Không thể kết nối máy chủ')) {
        throw error;
      }
      return saveMockPromotion(input, id);
    }
  },

  async remove(id: string): Promise<void> {
    if (!useDbCatalog) {
      const currentList = readLocal<ProductPromotion[]>(PROMOTIONS_KEY, defaultPromotions);
      const nextList = currentList.filter((item) => item.id !== id);
      writeLocal(PROMOTIONS_KEY, nextList);
      applyPromotionsToMockProducts(nextList);
      return;
    }
    try {
      await httpClient.delete(`${endpoint}/${id}`);
      broadcastSync(PROMOTIONS_KEY);
    } catch {
      const currentList = readLocal<ProductPromotion[]>(PROMOTIONS_KEY, defaultPromotions);
      const nextList = currentList.filter((item) => item.id !== id);
      writeLocal(PROMOTIONS_KEY, nextList);
      applyPromotionsToMockProducts(nextList);
    }
  },

  async resetDefaults(): Promise<ProductPromotion[]> {
    return resetMockPromotionsToDefault();
  },
};
