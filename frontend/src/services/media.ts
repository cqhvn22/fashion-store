import { httpClient, useDbCatalog } from './httpClient';

export async function uploadImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error('Ảnh phải có dung lượng tối đa 5 MB.');
  if (!useDbCatalog) return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
  const { data } = await httpClient.post<{ data: { url: string } }>('/admin/media', file, {
    headers: { 'Content-Type': file.type },
    timeout: 30000,
  });
  return data.data.url;
}

export async function uploadReviewImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error('Ảnh phải có dung lượng tối đa 5 MB.');
  if (!useDbCatalog) return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
  const { data } = await httpClient.post<{ data: { url: string } }>('/reviews/media', file, {
    headers: { 'Content-Type': file.type }, timeout: 30000,
  });
  return data.data.url;
}
