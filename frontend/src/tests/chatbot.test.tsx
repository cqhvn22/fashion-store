import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { chatService } from '../services/chat';
import { httpClient } from '../services/httpClient';
import { ChatWidget, FormattedChatMessage } from '../features/chat/ChatWidget';

describe('Chat dùng API AI', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('gửi cùng conversationId và hiển thị nguyên nội dung trả từ model', async () => {
    const post = vi.spyOn(httpClient, 'post').mockResolvedValue({
      data: { data: {
        id: 'answer-1', conversationId: 'conversation-1', role: 'ASSISTANT',
        content: 'Theo bảng size, bạn có thể cân nhắc size L [TL1].',
        answerOrigin: 'MODEL', provider: 'openrouter',
        sources: [{ documentId: 'size-1', title: 'Bảng size', excerpt: 'Size L', citation: 'TL1' }],
      } },
    });
    const answer = await chatService.send('1.7m 58kg', 'conversation-1');
    expect(post).toHaveBeenCalledWith('/chat',
      { message: '1.7m 58kg', conversationId: 'conversation-1' },
      { timeout: 90000 });
    expect(answer.content).toContain('size L [TL1]');
    expect(answer.answerOrigin).toBe('MODEL');
  });

  it('báo lỗi API, không thay bằng câu trả lời soạn sẵn', async () => {
    vi.spyOn(httpClient, 'post').mockRejectedValue(new Error('OpenRouter đang bận'));
    await expect(chatService.send('Gợi ý áo ấm', 'conversation-1'))
      .rejects.toThrow('OpenRouter đang bận');
  });

  it('giữ hội thoại khi đóng và mở lại widget', async () => {
    vi.spyOn(httpClient, 'post').mockResolvedValue({
      data: { data: {
        id: 'answer-1', conversationId: 'conversation-1', role: 'ASSISTANT',
        content: 'Bạn có thể cân nhắc size L [TL1].', sources: [],
      } },
    });
    render(<MemoryRouter><ChatWidget /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Tư vấn mua sắm/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nhập câu hỏi' }),
      { target: { value: '1.7m 58kg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    await waitFor(() => expect(screen.getByText(/cân nhắc size L/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Đóng chat' }));
    fireEvent.click(screen.getByRole('button', { name: /Tư vấn mua sắm/i }));
    expect(screen.getByText('1.7m 58kg')).toBeInTheDocument();
    expect(screen.getByText(/cân nhắc size L/i)).toBeInTheDocument();
  });

  it('hiển thị câu trả lời có mã nguồn', () => {
    render(<MemoryRouter><FormattedChatMessage
      content="Theo bảng size [TL1]."
      sources={[{ documentId: 'size-1', title: 'Bảng size', excerpt: 'Size L',
        citation: 'TL1', url: '/size-guide' }]}
    /></MemoryRouter>);
    expect(screen.getByText(/Theo bảng size/i)).toBeInTheDocument();
  });

  it('không lặp thẻ ảnh và nhiều liên kết cho cùng sản phẩm trong câu trả lời', () => {
    render(<MemoryRouter><FormattedChatMessage
      content={'Có hai mẫu để tham khảo:\n1. **Áo Phông A** — 100.000 đ [SP1]\n2. **Áo Phông B** — 120.000 đ [SP2]'}
      sources={[
        { documentId: 'a', title: 'Áo Phông A', excerpt: '100.000 đ', url: '/products/a', citation: 'SP1' },
        { documentId: 'b', title: 'Áo Phông B', excerpt: '120.000 đ', url: '/products/b', citation: 'SP2' },
      ]}
    /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: /Áo Phông A/i })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: /Áo Phông B/i })).toHaveLength(1);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('hiển thị ảnh sản phẩm và giá ngay tại phần gợi ý sản phẩm khi có nguồn hợp lệ', () => {
    render(<MemoryRouter><FormattedChatMessage
      content={'Dưới 200k có mẫu áo phù hợp:\n1. **Áo Nỉ Basic Vải Xốp Loose L.3.7795**\n- Màu sắc: Tiêu, Trắng, Đen'}
      sources={[
        {
          documentId: 'p-7795',
          title: 'Áo Nỉ Basic Vải Xốp Loose L.3.7795',
          excerpt: '119.000 đ • Màu: Tiêu, Trắng, Đen',
          url: '/products/ao-ni-basic-vai-xop-loose-l37795',
          imageUrl: '/images/products/ao-ni-7795.jpg',
          citation: 'SP1',
        },
      ]}
    /></MemoryRouter>);
    const img = screen.getByRole('img', { name: /Áo Nỉ Basic Vải Xốp Loose L.3.7795/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/images/products/ao-ni-7795.jpg');
    expect(screen.getByText('119.000 đ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Áo Nỉ Basic Vải Xốp Loose L.3.7795/i })).toBeInTheDocument();
  });
});
