import { seedKnowledge, seedProducts } from '../mocks/catalog';
import type { ChatMessage, KnowledgeDocument } from '../types/models';
import { endpoints } from './endpoints';
import { httpClient, mockMode } from './httpClient';
import { readLocal, writeLocal } from './storage';
const key = 'fashionhub_knowledge';
const conversationKey = 'fashionhub_conversations';
export const mockConversations = {
  list: () => readLocal<ChatMessage[]>(conversationKey, []),
  append: (message: ChatMessage) =>
    writeLocal(conversationKey, [...readLocal<ChatMessage[]>(conversationKey, []), message]),
};
export const knowledgeService = {
  async list(): Promise<KnowledgeDocument[]> {
    if (mockMode) return readLocal(key, seedKnowledge);
    const { data } = await httpClient.get<{ data: KnowledgeDocument[] }>(endpoints.admin.knowledge);
    return data.data;
  },
  async save(document: KnowledgeDocument) {
    if (!mockMode) {
      await httpClient.post(endpoints.admin.knowledge, document);
      return;
    }
    const items = await this.list();
    writeLocal(
      key,
      items.some((item) => item.id === document.id)
        ? items.map((item) => (item.id === document.id ? document : item))
        : [document, ...items],
    );
  },
  async remove(id: string) {
    if (!mockMode) {
      await httpClient.delete(`${endpoints.admin.knowledge}/${id}`);
      return;
    }
    writeLocal(
      key,
      (await this.list()).filter((item) => item.id !== id),
    );
  },
};
export const chatService = {
  async send(prompt: string, conversationId: string): Promise<ChatMessage> {
    if (!mockMode) {
      const { data } = await httpClient.post<{ data: ChatMessage }>(endpoints.chat, {
        message: prompt,
        conversationId,
      });
      return data.data;
    }
    const docs = await knowledgeService.list();
    const text = prompt.toLowerCase();
    const doc = docs.find(
      (item) =>
        item.status === 'INDEXED' &&
        ((text.includes('size') && item.id === 'doc-size') ||
          (text.includes('giao') && item.id === 'doc-shipping') ||
          (text.includes('đổi') && item.id === 'doc-returns') ||
          (text.includes('giặt') && item.id === 'doc-material')),
    );
    const productMatch = /áo|đầm|váy|quần|túi|khoác|phối|gợi ý/.test(text);
    const suggestions = productMatch
      ? seedProducts
          .filter((item) =>
            item.name
              .toLowerCase()
              .includes(
                text.includes('đầm')
                  ? 'đầm'
                  : text.includes('quần')
                    ? 'quần'
                    : text.includes('túi')
                      ? 'túi'
                      : 'áo',
              ),
          )
          .slice(0, 2)
      : [];
    const answer: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: 'ASSISTANT',
      content: doc
        ? doc.content
        : suggestions.length
          ? `Bạn có thể tham khảo ${suggestions.map((item) => item.name).join(' hoặc ')}. Mình đã chọn từ danh mục hiện có của FashionHub.`
          : 'Mình chưa có đủ dữ liệu để trả lời chính xác câu hỏi này. Bạn có thể hỏi về chọn size, giao hàng, đổi trả, bảo quản hoặc gợi ý sản phẩm.',
      sources: doc ? [{ documentId: doc.id, title: doc.title, excerpt: doc.content }] : [],
      suggestedProductIds: suggestions.map((item) => item.id),
      createdAt: new Date().toISOString(),
    };
    mockConversations.append(answer);
    return answer;
  },
};
