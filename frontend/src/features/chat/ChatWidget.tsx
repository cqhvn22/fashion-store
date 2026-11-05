import { useState } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { chatService, mockConversations } from '../../services/chat';
import { mockMode } from '../../services/httpClient';
import { getMockProducts } from '../../services/catalog';
import type { ChatMessage } from '../../types/models';
const prompts = [
  'Tư vấn chọn size',
  'Phí giao hàng thế nào?',
  'Chính sách đổi trả',
  'Gợi ý áo đẹp',
];
function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [conversationId] = useState(() => crypto.randomUUID());
  const send = async (content: string) => {
    if (!content.trim() || pending) return;
    setError('');
    const question: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((items) => [...items, question]);
    if (mockMode) mockConversations.append(question);
    setPending(true);
    try {
      const answer = await chatService.send(content, conversationId);
      setMessages((items) => [...items, answer]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi câu hỏi.');
    } finally {
      setPending(false);
    }
  };
  return { messages, pending, error, send };
}
function ChatPanel({ expanded = false }: { expanded?: boolean }) {
  const { messages, pending, error, send } = useChatSession();
  const [input, setInput] = useState('');
  return (
    <div className={`chat-panel ${expanded ? 'chat-expanded' : ''}`}>
      <div className="bg-ink text-white p-4 flex items-center gap-2">
        <Bot size={20} />
        <div>
          <strong>Trợ lý FashionHub</strong>
          <p className="text-xs text-slate-300">Tư vấn dựa trên dữ liệu demo</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {!messages.length && (
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-ink mb-2">Xin chào! Mình có thể giúp gì?</p>
            <p>Hỏi về sản phẩm, chọn size, giao hàng hoặc đổi trả.</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  className="border border-brand/30 text-brand rounded-full px-3 py-1.5 text-xs hover:bg-orange-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'USER' ? 'chat-message-user' : 'chat-message-bot'}
          >
            <p>{message.content}</p>
            {message.sources?.map((source) => (
              <div key={source.documentId} className="text-xs border-t mt-2 pt-2 text-slate-500">
                Nguồn: {source.title}
              </div>
            ))}
            {message.suggestedProductIds?.map((id) => {
              const product = getMockProducts().find((item) => item.id === id);
              return product ? (
                <Link
                  key={id}
                  to={`/products/${product.slug}`}
                  className="block text-xs text-brand underline mt-2"
                >
                  Xem {product.name} →
                </Link>
              ) : null;
            })}
          </div>
        ))}
        {pending && <div className="chat-message-bot text-slate-500">Đang trả lời...</div>}
        {error && <p className="field-error text-sm">{error}</p>}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
          setInput('');
        }}
        className="border-t p-3 flex gap-2"
      >
        <input
          aria-label="Nhập câu hỏi"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Hỏi FashionHub..."
          className="field flex-1"
        />
        <button disabled={pending || !input.trim()} aria-label="Gửi" className="btn-primary px-3">
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 shadow-xl relative">
          <button
            aria-label="Đóng chat"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-4 text-white"
          >
            <X size={19} />
          </button>
          <ChatPanel />
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý AI'}
        className="chat-fab"
      >
        <MessageCircle size={23} />
        <span className="hidden sm:inline">Tư vấn AI</span>
      </button>
    </div>
  );
}
export function ChatPage() {
  return (
    <div className="container-shell py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <span className="eyebrow text-brand">AI SHOPPING ASSISTANT</span>
          <h1 className="text-3xl font-bold">Trợ lý mua sắm</h1>
          <p className="text-slate-500 mt-2">
            Hỏi về sản phẩm và chính sách. Câu trả lời mock có nguồn tham khảo khi dữ liệu phù hợp.
          </p>
        </div>
        <ChatPanel expanded />
      </div>
    </div>
  );
}
