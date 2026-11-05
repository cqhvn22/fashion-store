import { categories, seedProducts } from '../mocks/catalog';
import type { Category, PageResponse, Product, ProductQuery } from '../types/models';
import { endpoints } from './endpoints';
import { httpClient, mockMode } from './httpClient';
import { readLocal, writeLocal } from './storage';

const key = 'fashionhub_products';
export const getMockProducts = () => readLocal<Product[]>(key, seedProducts);
export const saveMockProducts = (products: Product[]) => writeLocal(key, products);
export const getMockCategories = () => readLocal<Category[]>('fashionhub_categories', categories);
export const categoryService = {
  async list(): Promise<Category[]> {
    if (mockMode) return getMockCategories();
    const { data } = await httpClient.get<{ data: Category[] }>(endpoints.categories);
    return data.data;
  },
  async save(category: Category) {
    if (!mockMode) throw new Error('Chưa tích hợp API quản lý danh mục.');
    const items = getMockCategories();
    writeLocal(
      'fashionhub_categories',
      items.some((item) => item.id === category.id)
        ? items.map((item) => (item.id === category.id ? category : item))
        : [...items, category],
    );
  },
  async remove(id: string) {
    if (!mockMode) throw new Error('Chưa tích hợp API quản lý danh mục.');
    if (getMockProducts().some((item) => item.categoryId === id))
      throw new Error('Danh mục đang có sản phẩm, không thể xóa.');
    writeLocal(
      'fashionhub_categories',
      getMockCategories().filter((item) => item.id !== id),
    );
  },
};
export const productService = {
  async list(query: ProductQuery = {}): Promise<PageResponse<Product>> {
    if (!mockMode) {
      const { data } = await httpClient.get<{ data: PageResponse<Product> }>(endpoints.products, {
        params: query,
      });
      return data.data;
    }
    let items = getMockProducts().filter((item) => item.status === 'ACTIVE');
    if (query.category) {
      const category = getMockCategories().find((item) => item.slug === query.category);
      items = items.filter((item) => item.categoryId === category?.id);
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
    if (mockMode) {
      const product = getMockProducts().find((item) => item.slug === slug);
      if (!product) throw new Error('Không tìm thấy sản phẩm.');
      return product;
    }
    const { data } = await httpClient.get<{ data: Product }>(endpoints.productSlug(slug));
    return data.data;
  },
  async byId(id: string): Promise<Product> {
    if (mockMode) {
      const product = getMockProducts().find((item) => item.id === id);
      if (!product) throw new Error('Không tìm thấy sản phẩm.');
      return product;
    }
    const { data } = await httpClient.get<{ data: Product }>(`${endpoints.products}/${id}`);
    return data.data;
  },
  async save(product: Product): Promise<Product> {
    if (!mockMode) {
      const { data } = product.id
        ? await httpClient.put<{ data: Product }>(
            `${endpoints.admin.products}/${product.id}`,
            product,
          )
        : await httpClient.post<{ data: Product }>(endpoints.admin.products, product);
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
    if (!mockMode) {
      await httpClient.delete(`${endpoints.admin.products}/${id}`);
      return;
    }
    saveMockProducts(getMockProducts().filter((item) => item.id !== id));
  },
};
