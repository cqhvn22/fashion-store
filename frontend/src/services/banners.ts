import type { HomeBanner } from '../types/models';
import { httpClient, useDbCatalog } from './httpClient';
import { readLocal, writeLocal } from './storage';

const key = 'fashionhub_banners';
const demo: HomeBanner[] = [
  { id: 'demo-banner-1', title: 'ATINO — phong cách mỗi ngày', subtitle: 'Khám phá áo nam, quần và phụ kiện trong bộ sưu tập ATINO.', imageUrl: '/images/products/ao-ni-basic-vai-xop-loose-l.3.7795-p37939753_1.png', linkUrl: '/categories/ao-nam', buttonLabel: 'Khám phá ngay', sortOrder: 0, isActive: true },
  { id: 'demo-banner-2', title: 'Bộ sưu tập ATINO mới', subtitle: 'Chọn trang phục thoải mái, phù hợp phong cách của bạn.', imageUrl: '/images/products/ao-phong-loose-l.3.2755-p37937106_1.jpg', linkUrl: '/products', buttonLabel: 'Xem sản phẩm', sortOrder: 1, isActive: true },
];
export const bannerService = {
  async list(): Promise<HomeBanner[]> {
    if (!useDbCatalog) return readLocal(key, demo).filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
    const { data } = await httpClient.get<{ data: HomeBanner[] }>('/banners');
    return data.data;
  },
  async listAdmin(): Promise<HomeBanner[]> {
    if (!useDbCatalog) return readLocal(key, demo);
    const { data } = await httpClient.get<{ data: HomeBanner[] }>('/admin/banners');
    return data.data;
  },
  async save(item: HomeBanner): Promise<void> {
    if (!useDbCatalog) {
      const list = readLocal(key, demo);
      writeLocal(key, list.some((entry) => entry.id === item.id) ? list.map((entry) => entry.id === item.id ? item : entry) : [...list, item]);
      return;
    }
    if (item.id) await httpClient.put(`/admin/banners/${item.id}`, item);
    else await httpClient.post('/admin/banners', item);
  },
  async remove(id: string): Promise<void> {
    if (!useDbCatalog) writeLocal(key, readLocal(key, demo).filter((item) => item.id !== id));
    else await httpClient.delete(`/admin/banners/${id}`);
  },
};
