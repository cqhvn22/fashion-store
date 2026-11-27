import { categories, seedProducts } from '../mocks/catalog';
import type { Category, HomeCategoryShowcase, PageResponse, Product, ProductQuery } from '../types/models';
import { endpoints } from './endpoints';
import { httpClient, useDbCatalog } from './httpClient';
import { applyPromotionsToProductList, getMockPromotions } from './promotions';
import { broadcastSync, readLocal, writeLocal } from './storage';

const key = 'fashionhub_products';
const DATASET_VERSION_KEY = 'fashionhub_catalog_dataset_version';
const CURRENT_DATASET_VERSION = 'atino_pure_v2';

export const getMockCategories = () => {
  const storageKey = 'fashionhub_categories';
  try {
    if (localStorage.getItem(DATASET_VERSION_KEY) !== CURRENT_DATASET_VERSION) {
      writeLocal(storageKey, categories);
      return categories;
    }
  } catch {
    /* ignore */
  }
  return readLocal<Category[]>(storageKey, categories);
};

export const saveMockProducts = (products: Product[]) => writeLocal(key, products);

export const getMockProducts = () => {
  let stored = readLocal<Product[]>(key, seedProducts);
  try {
    if (localStorage.getItem(DATASET_VERSION_KEY) !== CURRENT_DATASET_VERSION) {
      writeLocal(key, seedProducts);
      localStorage.setItem(DATASET_VERSION_KEY, CURRENT_DATASET_VERSION);
      stored = seedProducts;
    }
  } catch {
    /* ignore */
  }

  const promos = getMockPromotions();
  return applyPromotionsToProductList(stored, promos, getMockCategories());
};
export const categoryService = {
  async list(): Promise<Category[]> {
    if (!useDbCatalog) return getMockCategories();
    const { data } = await httpClient.get<{ data: Category[] }>(endpoints.categories);
    return data.data;
  },
  async listAdmin(): Promise<Category[]> {
    if (!useDbCatalog) return getMockCategories();
    const { data } = await httpClient.get<{ data: Category[] }>('/admin/categories');
    return data.data;
  },
  async save(category: Category) {
    if (useDbCatalog) {
      const payload = {
        name: category.name, slug: category.slug, description: category.description,
        imageUrl: category.imageUrl, parentId: category.parentId ?? null,
        isActive: category.isActive,
      };
      if (category.id) await httpClient.put(`/admin/categories/${category.id}`, payload);
      else await httpClient.post('/admin/categories', payload);
      broadcastSync('fashionhub_categories');
      return;
    }
    const items = getMockCategories();
    writeLocal(
      'fashionhub_categories',
      items.some((item) => item.id === category.id)
        ? items.map((item) => (item.id === category.id ? category : item))
        : [...items, category],
    );
  },
  async remove(id: string) {
    if (useDbCatalog) {
      await httpClient.delete(`/admin/categories/${id}`);
      broadcastSync('fashionhub_categories');
      return;
    }
    if (getMockCategories().some((item) => item.parentId === id))
      throw new Error('Danh mục đang có danh mục con, không thể xóa.');
    if (getMockProducts().some((item) => item.categoryId === id))
      throw new Error('Danh mục đang có sản phẩm, không thể xóa.');
    writeLocal(
      'fashionhub_categories',
      getMockCategories().filter((item) => item.id !== id),
    );
  },
};
export const productService = {
  async homeSelection(section: 'new' | 'popular' | 'sale' | 'category', seed: number, showcase?: HomeCategoryShowcase): Promise<Product[]> {
    if (useDbCatalog) {
      const { data } = await httpClient.get<{ data: Product[] }>(`${endpoints.products}/home-selection`, {
        params: { section, seed, showcaseId: showcase?.id },
      });
      return data.data;
    }
    const slug = getMockCategories().find(category => category.id === showcase?.categoryId)?.slug;
    let { content } = await productService.list({
      category: showcase?.selectionMode === 'ALL' ? slug : undefined,
      limit: Number.MAX_SAFE_INTEGER,
    });
    if (showcase?.selectionMode === 'ALL' && !slug) return [];
    if (showcase?.selectionMode === 'CUSTOM') content = content.filter(p => showcase.productIds?.includes(p.id));
    if (section === 'sale') content = content.filter(p => p.variants.some(v => v.compareAtPrice && v.compareAtPrice > v.price));
    let state = seed;
    for (let i = content.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = Math.floor((state / 2 ** 32) * (i + 1));
      [content[i], content[j]] = [content[j], content[i]];
    }
    const bySales = (a: Product, b: Product) => b.soldCount - a.soldCount;
    if (section === 'new' || section === 'popular') {
      const sorted = [...content].sort(section === 'new' ? (a, b) => b.createdAt.localeCompare(a.createdAt) : bySales);
      const pool = new Set(sorted.slice(0, 32));
      content = content.filter(p => pool.has(p));
    }
    const limit = showcase?.displayLimit || 8;
    const top = [...content].sort(bySales).filter(p => p.soldCount > 0).slice(0, Math.max(1, Math.floor(limit / 4)));
    return [...top, ...content.filter(p => !top.includes(p))].slice(0, limit).sort(bySales);
  },
  async listAdmin(): Promise<Product[]> {
    if (!useDbCatalog) return getMockProducts();
    const items: Product[] = [];
    let page = 1;
    while (true) {
      const { data } = await httpClient.get<{ data: PageResponse<Product> }>('/admin/products', { params: { page, limit: 100 } });
      items.push(...data.data.content);
      if (data.data.last) return items;
      page += 1;
    }
  },
  async adminById(id: string): Promise<Product> {
    if (!useDbCatalog) {
      const item = getMockProducts().find((product) => product.id === id);
      if (!item) throw new Error('Không tìm thấy sản phẩm.');
      return item;
    }
    const { data } = await httpClient.get<{ data: Product }>(`/admin/products/${id}`);
    return data.data;
  },
  async list(query: ProductQuery = {}): Promise<PageResponse<Product>> {
    if (useDbCatalog) {
      const { data } = await httpClient.get<{ data: PageResponse<Product> }>(endpoints.products, {
        params: query,
      });
      return data.data;
    }
    let items = getMockProducts().filter((item) => item.status === 'ACTIVE');
    if (query.category) {
      const all = getMockCategories();
      const category = all.find((item) => item.slug === query.category);
      const ids = new Set(category ? [category.id] : []);
      let changed = true;
      while (changed) {
        changed = false;
        for (const child of all) {
          if (child.parentId && ids.has(child.parentId) && !ids.has(child.id)) {
            ids.add(child.id);
            changed = true;
          }
        }
      }
      items = items.filter((item) => ids.has(item.categoryId));
    }
    if (query.q)
      items = items.filter((item) =>
        `${item.name} ${item.description}`.toLowerCase().includes(query.q!.toLowerCase()),
      );
    if (query.minPrice) items = items.filter((item) => item.minPrice >= query.minPrice!);
    if (query.maxPrice) items = items.filter((item) => item.minPrice <= query.maxPrice!);
    if (query.size)
      items = items.filter((item) =>
        item.variants.some((variant) => variant.size === query.size && variant.stockQuantity > 0),
      );
    if (query.color)
      items = items.filter((item) =>
        item.variants.some((variant) => variant.color === query.color && variant.stockQuantity > 0),
      );
    if (query.sort === 'price_asc') items.sort((a, b) => a.minPrice - b.minPrice);
    if (query.sort === 'price_desc') items.sort((a, b) => b.minPrice - a.minPrice);
    if (query.sort === 'newest') items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (query.sort === 'bestselling') items.sort((a, b) => b.soldCount - a.soldCount);
    const page = Math.max(1, query.page ?? 1),
      size = query.limit ?? 12;
    return {
      content: items.slice((page - 1) * size, page * size),
      page,
      size,
      totalElements: items.length,
      totalPages: Math.ceil(items.length / size),
      last: page * size >= items.length,
    };
  },
  async bySlug(slug: string): Promise<Product> {
    if (!useDbCatalog) {
      const product = getMockProducts().find((item) => item.slug === slug || item.id === slug);
      if (!product) throw new Error('Không tìm thấy sản phẩm.');
      return product;
    }
    try {
      const { data } = await httpClient.get<{ data: Product }>(endpoints.productSlug(slug));
      return data.data;
    } catch (err) {
      // Fallback nếu tham số là productId
      try {
        const { data } = await httpClient.get<{ data: Product }>(`${endpoints.products}/${slug}`);
        return data.data;
      } catch {
        throw err;
      }
    }
  },
  async byId(id: string): Promise<Product> {
    if (!useDbCatalog) {
      const product = getMockProducts().find((item) => item.id === id);
      if (!product) throw new Error('Không tìm thấy sản phẩm.');
      return product;
    }
    const { data } = await httpClient.get<{ data: Product }>(`${endpoints.products}/${id}`);
    return data.data;
  },
  async save(product: Product): Promise<Product> {
    if (useDbCatalog) {
      const { data } = product.id && product.id !== 'new'
        ? await httpClient.put<{ data: Product }>(
            `${endpoints.admin.products}/${product.id}`,
            product,
          )
        : await httpClient.post<{ data: Product }>(endpoints.admin.products, product);
      broadcastSync('fashionhub_products');
      return data.data;
    }
    const items = getMockProducts();
    const next = items.some((item) => item.id === product.id)
      ? items.map((item) => (item.id === product.id ? product : item))
      : [product, ...items];
    saveMockProducts(next);
    return product;
  },
  async remove(id: string) {
    if (useDbCatalog) {
      await httpClient.delete(`${endpoints.admin.products}/${id}`);
      broadcastSync('fashionhub_products');
      return;
    }
    saveMockProducts(getMockProducts().filter((item) => item.id !== id));
  },
};
