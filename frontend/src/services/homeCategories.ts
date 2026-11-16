import type { HomeCategoryShowcase } from '../types/models';
import { httpClient, useDbCatalog } from './httpClient';
import { readLocal, writeLocal } from './storage';

const key = 'fashionhub_home_categories';
const demo: HomeCategoryShowcase[] = [
  {
    id: 'demo-home-cat-1',
    categoryId: 'cat-atino-ao-polo',
    title: 'BỘ SƯU TẬP ÁO POLO',
    subtitle: 'Thanh lịch, thoáng mát, chất liệu cotton cao cấp cho phái mạnh',
    selectionMode: 'ALL',
    productIds: [],
    displayLimit: 8,
    sortOrder: 0,
    isActive: true,
    category: {
      id: 'cat-atino-ao-polo',
      name: 'Áo polo nam',
      slug: 'ao-polo',
    },
  },
  {
    id: 'demo-home-cat-2',
    categoryId: 'cat-04',
    title: 'QUẦN SHORT NĂNG ĐỘNG',
    subtitle: 'Thiết kế trẻ trung, thoáng nhẹ, dễ vận động cho ngày hè',
    selectionMode: 'ALL',
    productIds: [],
    displayLimit: 8,
    sortOrder: 1,
    isActive: true,
    category: {
      id: 'cat-04',
      name: 'Quần',
      slug: 'quan',
    },
  },
];

export const homeCategoryService = {
  async list(): Promise<HomeCategoryShowcase[]> {
    if (!useDbCatalog) {
      return readLocal(key, demo)
        .filter((item) => item.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    try {
      const { data } = await httpClient.get<{ data: HomeCategoryShowcase[] }>('/home-categories');
      return data.data;
    } catch {
      // Fallback
      const { data } = await httpClient.get<{ data: HomeCategoryShowcase[] }>('/categories/home-showcases');
      return data.data;
    }
  },

  async listAdmin(): Promise<HomeCategoryShowcase[]> {
    if (!useDbCatalog) {
      return readLocal(key, demo).sort((a, b) => a.sortOrder - b.sortOrder);
    }
    try {
      const { data } = await httpClient.get<{ data: HomeCategoryShowcase[] }>('/admin/home-categories');
      return data.data;
    } catch {
      // Fallback
      const { data } = await httpClient.get<{ data: HomeCategoryShowcase[] }>('/admin/categories/home-showcases');
      return data.data;
    }
  },

  async save(item: Partial<HomeCategoryShowcase>): Promise<HomeCategoryShowcase> {
    if (!useDbCatalog) {
      const list = readLocal(key, demo);
      const id = item.id || crypto.randomUUID();
      const updated: HomeCategoryShowcase = {
        id,
        categoryId: item.categoryId || '',
        title: item.title || '',
        subtitle: item.subtitle || '',
        selectionMode: item.selectionMode || 'ALL',
        productIds: item.productIds || [],
        displayLimit: item.displayLimit || 8,
        sortOrder: item.sortOrder ?? 0,
        isActive: item.isActive ?? true,
        category: item.category,
      };
      const next = list.some((entry) => entry.id === id)
        ? list.map((entry) => (entry.id === id ? updated : entry))
        : [...list, updated];
      writeLocal(key, next);
      return updated;
    }

    const payload = {
      categoryId: item.categoryId,
      title: item.title,
      subtitle: item.subtitle || '',
      selectionMode: item.selectionMode || 'ALL',
      productIds: item.productIds || [],
      displayLimit: item.displayLimit || 8,
      sortOrder: item.sortOrder ?? 0,
      isActive: item.isActive ?? true,
    };

    if (item.id && !item.id.startsWith('demo-')) {
      const { data } = await httpClient.put<{ data: HomeCategoryShowcase }>(
        `/admin/home-categories/${item.id}`,
        payload,
      );
      return data.data;
    } else {
      const { data } = await httpClient.post<{ data: HomeCategoryShowcase }>(
        '/admin/home-categories',
        payload,
      );
      return data.data;
    }
  },

  async remove(id: string): Promise<void> {
    if (!useDbCatalog) {
      writeLocal(key, readLocal(key, demo).filter((item) => item.id !== id));
      return;
    }
    await httpClient.delete(`/admin/home-categories/${id}`);
  },
};
