import type { ChatMessage, KnowledgeDocument } from '../types/models';
import { endpoints } from './endpoints';
import { httpClient } from './httpClient';
import { readLocal, writeLocal } from './storage';

const key = 'fashionhub_knowledge';
const conversationKey = 'fashionhub_conversations';

interface ProductKnowledgeStatus {
  workbook?: { total: number; indexed: number; deleted: number } | null;
  catalog?: { total: number; indexed: number; deleted: number } | null;
  documents?: Record<string, number>;
  last_sync?: string | null;
  started_at?: string | null;
  running?: boolean;
  queued?: boolean;
  error?: string | null;
}

export const mockConversations = {
  list: () => readLocal<ChatMessage[]>(conversationKey, []),
  append: (message: ChatMessage) =>
    writeLocal(conversationKey, [...readLocal<ChatMessage[]>(conversationKey, []), message]),
};

export const knowledgeService = {
  async importLegacy(): Promise<number> {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    let items: KnowledgeDocument[];
    try { items = JSON.parse(raw) as KnowledgeDocument[]; } catch { return 0; }
    if (!Array.isArray(items)) return 0;
    const importedKey = `${key}_imported_ids`;
    const imported = new Set(readLocal<string[]>(importedKey, []));
    const existing = await this.list();
    let count = 0;
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(item.id)
          || imported.has(item.id) || typeof item.title !== 'string' || typeof item.content !== 'string') continue;
      if (existing.some((doc) => doc.title === item.title && doc.content === item.content)) {
        imported.add(item.id);
        continue;
      }
      await httpClient.post(endpoints.admin.knowledge,
        { title: item.title.trim(), content: item.content.trim() });
      imported.add(item.id);
      writeLocal(importedKey, [...imported]);
      count += 1;
    }
    writeLocal(importedKey, [...imported]);
    return count;
  },
  async list(): Promise<KnowledgeDocument[]> {
    const { data } = await httpClient.get<{ data: KnowledgeDocument[] }>(endpoints.admin.knowledge);
    return data.data;
  },
  async save(document: KnowledgeDocument) {
    const payload = { title: document.title, content: document.content };
    if (document.id) await httpClient.put(`${endpoints.admin.knowledge}/${document.id}`, payload);
    else await httpClient.post(endpoints.admin.knowledge, payload);
  },
  async remove(id: string) {
    await httpClient.delete(`${endpoints.admin.knowledge}/${id}`);
  },
  async reindex(id: string) {
    await httpClient.post(`${endpoints.admin.knowledge}/${id}/reindex`);
  },
  async setActive(id: string, isActive: boolean) {
    await httpClient.patch(`${endpoints.admin.knowledge}/${id}/active`, { isActive });
  },
  async productStatus(): Promise<ProductKnowledgeStatus> {
    const { data } = await httpClient.get<{ data: ProductKnowledgeStatus }>(
      '/admin/ai/index-status');
    return data.data;
  },
  async refreshProducts() {
    await httpClient.post('/admin/ai/reindex');
  },
};

export const chatService = {
  async send(prompt: string, conversationId: string): Promise<ChatMessage> {
    const { data } = await httpClient.post<{ data: ChatMessage }>(
      endpoints.chat,
      { message: prompt, conversationId },
      { timeout: 90000 },
    );
    if (!data?.data?.content) {
      throw new Error('Trợ lý chưa nhận được câu trả lời. Vui lòng thử lại.');
    }
    return data.data;
  },
};
