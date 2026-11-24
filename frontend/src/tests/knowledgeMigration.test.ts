import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('chuyển tri thức cũ từ trình duyệt vào AI service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_DB_AI', 'true');
    localStorage.clear();
  });

  it('chỉ chuyển tài liệu quản trị đã tạo và không tạo trùng khi tải lại', async () => {
    const { knowledgeService } = await import('../services/chat');
    const { httpClient } = await import('../services/httpClient');
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({ data: { data: [] } });
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { data: {} } });
    localStorage.setItem('fashionhub_knowledge', JSON.stringify([
      { id: 'doc-size', title: 'Hướng dẫn chọn size', content: 'Dữ liệu mẫu' },
      { id: '43f12a7d-c92f-42d5-96c7-d5b7a88c0323', title: 'Nếu user nói hello',
        content: 'Trả lời là "Hello world"' },
    ]));

    expect(await knowledgeService.importLegacy()).toBe(1);
    expect(post).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledWith('/admin/knowledge', {
      title: 'Nếu user nói hello', content: 'Trả lời là "Hello world"',
    });
    expect(await knowledgeService.importLegacy()).toBe(0);
    expect(post).toHaveBeenCalledOnce();
    get.mockRestore();
    post.mockRestore();
  });

  it('luôn gọi AI service cho trang quản trị dù frontend bật dữ liệu mẫu', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_DB_AI', 'false');
    vi.stubEnv('VITE_ENABLE_MOCK', 'true');
    const { knowledgeService } = await import('../services/chat');
    const { httpClient } = await import('../services/httpClient');
    const get = vi.spyOn(httpClient, 'get').mockResolvedValue({
      data: { data: { catalog: { total: 13, indexed: 0, deleted: 0 }, documents: { catalog: 13 } } },
    });
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({ data: { data: { queued: true } } });

    expect((await knowledgeService.productStatus()).documents).toEqual({ catalog: 13 });
    await knowledgeService.refreshProducts();
    expect(get).toHaveBeenCalledWith('/admin/ai/index-status');
    expect(post).toHaveBeenCalledWith('/admin/ai/reindex');
    get.mockRestore();
    post.mockRestore();
  });
});
