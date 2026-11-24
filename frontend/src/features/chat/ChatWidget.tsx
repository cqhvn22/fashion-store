import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  MessageCircle,
  Send,
  X,
  BookOpen,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { chatService } from '../../services/chat';
import { readLocal, writeLocal } from '../../services/storage';
import { useAuthStore } from '../../stores/authStore';
import type { ChatMessage, ChatSource } from '../../types/models';

const prompts = [
  'Tư vấn chọn size',
  'Phí giao hàng thế nào?',
  'Chính sách đổi trả',
  'Gợi ý áo đẹp',
];

function renderInline(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\)|\bhttps?:\/\/[^\s\)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      const inner = token.slice(2, -2);
      elements.push(
        <strong key={`b-${match.index}`} className="font-bold text-slate-900">
          {inner}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      const inner = token.slice(1, -1);
      elements.push(
        <em key={`i-${match.index}`} className="italic text-slate-700">
          {inner}
        </em>,
      );
    } else if (token.startsWith('[') && token.includes('](') && token.endsWith(')')) {
      const closeBracket = token.indexOf('](');
      const linkText = token.slice(1, closeBracket);
      const linkUrl = token.slice(closeBracket + 2, -1);
      elements.push(
        <a
          key={`a-${match.index}`}
          href={linkUrl}
          className="text-brand hover:underline font-semibold"
          target={linkUrl.startsWith('/') ? undefined : '_blank'}
          rel="noreferrer"
        >
          {linkText}
        </a>,
      );
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      elements.push(
        <a
          key={`url-${match.index}`}
          href={token}
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline text-xs break-all"
        >
          {token}
        </a>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  return elements.length > 0 ? elements : [text];
}

interface MatchedProduct {
  title: string;
  url: string;
  imageUrl: string;
  price?: string;
}

function normalizeProductUrl(url?: string): string {
  if (!url) return '';
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/products/')) {
        return parsed.pathname;
      }
    }
  } catch {}
  return url;
}

function findProductInSources(
  title: string,
  sources?: ChatSource[],
  itemIndex?: number,
): MatchedProduct | null {
  if (!sources || sources.length === 0) return null;
  const productSources = sources.filter((s) => s.url && s.url.includes('/products/'));
  if (productSources.length === 0) return null;

  const clean = (title || '')
    .replace(/^\[SP\d+\]\s*/i, '')
    .replace(/\[SP\d+\]/gi, '')
    .replace(/^[\d\.\)\s•*-]+/, '')
    .replace(/[*_#]/g, '')
    .trim()
    .toLowerCase();

  const codeMatch = clean.match(/([a-z]\.\d+\.\d+)/i) || clean.match(/(p\d{6,})/i);
  const code = codeMatch ? codeMatch[1].toLowerCase() : null;
  const cleanTitleOnly = clean.split(/[—\-|]/)[0].trim();

  for (const s of productSources) {
    const sTitle = (s.title || '').replace(/[*_#]/g, '').trim().toLowerCase();
    const sUrl = (s.url || '').toLowerCase();

    if (
      sTitle === clean ||
      sTitle === cleanTitleOnly ||
      (clean.length > 5 && sTitle.includes(cleanTitleOnly)) ||
      (cleanTitleOnly.length > 5 && clean.includes(sTitle)) ||
      (code && (sTitle.includes(code) || sUrl.includes(code)))
    ) {
      let priceStr = '';
      if (s.excerpt) {
        const matchPrice = s.excerpt.match(/(\d[\d\.,]*\s*(?:đ|vnđ|vnd))/i);
        if (matchPrice) priceStr = matchPrice[1];
      }
      return {
        title: s.title || title,
        url: normalizeProductUrl(s.url),
        imageUrl: s.imageUrl || '',
        price: priceStr || undefined,
      };
    }
  }

  // Fallback by index (itemIndex 0 -> productSources[0])
  if (typeof itemIndex === 'number' && itemIndex >= 0 && itemIndex < productSources.length) {
    const s = productSources[itemIndex];
    let priceStr = '';
    if (s.excerpt) {
      const matchPrice = s.excerpt.match(/(\d[\d\.,]*\s*(?:đ|vnđ|vnd))/i);
      if (matchPrice) priceStr = matchPrice[1];
    }
    return {
      title: s.title || title,
      url: normalizeProductUrl(s.url),
      imageUrl: s.imageUrl || '',
      price: priceStr || undefined,
    };
  }

  return null;
}

export function FormattedChatMessage({
  content,
  sources,
}: {
  content: string;
  sources?: ChatSource[];
}) {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      nodes.push(<div key={`empty-${i}`} className="h-1.5" />);
      continue;
    }

    // 0. Horizontal divider rule: "---", "***", "___"
    if (/^[-*_]{3,}$/.test(trimmed)) {
      nodes.push(<div key={`div-${i}`} className="my-2 border-t border-slate-100" />);
      continue;
    }

    // 1. Numbered item: "1. **Áo Phông Regular...**" or "### 1. **Áo Phông Loose...** (Giá rẻ...)" or "1) Áo Phông..."
    const numMatch = trimmed.match(
      /^(?:#{1,6}\s*|[#*•-]+\s*)?(\d+)[.\)]\s+(.*)$/,
    );
    if (numMatch && numMatch[1] && numMatch[2]) {
      const num = numMatch[1];
      const rawLineContent = numMatch[2].trim();
      // Extract bold product name if present, otherwise strip markdown
      const boldMatch = rawLineContent.match(/\*\*([^*]+)\*\*/);
      const linkMatch = rawLineContent.match(/\[([^\]]+)\]\([^)]+\)/);
      const rawTitle = (boldMatch ? boldMatch[1] : linkMatch ? linkMatch[1] : rawLineContent)
        .replace(/[*_#]/g, '')
        .trim();
      const extraText = boldMatch
        ? rawLineContent.replace(boldMatch[0], '').replace(/^[-(—\s]+|[)-]+$/g, '').trim()
        : '';

      const numInt = parseInt(num, 10);
      const product = findProductInSources(
        rawTitle,
        sources,
        !isNaN(numInt) ? numInt - 1 : undefined,
      );

      const hasSubsequentPriceLine = lines
        .slice(i + 1, i + 5)
        .some(
          (l) =>
            /^(?:[-*•|]\s*)?(?:\*\*([^*:]+):\*\*|\*\*([^*:]+)\*\*:\s*|([A-Za-zÀ-ỹ\s]{2,20}):)/.test(
              l.trim(),
            ) && l.toLowerCase().includes('giá'),
        );

      nodes.push(
        <div
          key={`item-${i}`}
          className="mt-3.5 first:mt-0 pt-2.5 first:pt-0 border-t border-slate-200/80 first:border-0"
        >
          {product ? (
            <div className="flex items-center gap-3 p-2.5 mb-2 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:border-brand/40 transition">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg shrink-0 border border-slate-100 bg-slate-50 shadow-sm"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      '/images/product-placeholder.svg';
                  }}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 bg-brand/10 text-brand">
                    {num}
                  </span>
                  <Link
                    to={product.url}
                    className="font-bold text-slate-900 text-sm hover:text-brand transition no-underline truncate"
                    title={product.title}
                  >
                    {rawTitle}
                    {extraText ? (
                      <span className="text-xs font-normal text-slate-500 ml-1.5 italic">
                        ({extraText})
                      </span>
                    ) : null}
                  </Link>
                </div>
                {product.price && !hasSubsequentPriceLine ? (
                  <div className="text-red-600 font-bold text-xs sm:text-sm pl-6 sm:pl-7">
                    {product.price}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 bg-brand/10 text-brand">
                  {num}
                </span>
                <span className="font-bold text-slate-900 text-sm truncate">
                  {rawTitle}
                  {extraText ? (
                    <span className="text-xs font-normal text-slate-500 ml-1.5 italic">
                      ({extraText})
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          )}
        </div>,
      );
      continue;
    }

    // 2. Attribute bullet item: "- **Giá:** 99.000 đ" or "| Giá bán: **125.100 đ**" or "- Màu sắc: ..."
    const kvMatch = trimmed.match(
      /^(?:[-*•|]\s*)?(?:\*\*([^*:]+):\*\*|\*\*([^*:]+)\*\*:\s*|([A-Za-zÀ-ỹ\s]{2,20}):)\s*(.*)$/,
    );
    if (kvMatch) {
      const key = (kvMatch[1] || kvMatch[2] || kvMatch[3] || '').trim();
      const rawVal = (kvMatch[4] || '').trim();
      const cleanVal = rawVal.replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
      const kLower = key.toLowerCase();

      if (kLower.includes('giá')) {
        nodes.push(
          <div
            key={`kv-${i}`}
            className="flex items-center gap-2 text-xs py-0.5 pl-2.5 ml-2 border-l-2 border-brand/40"
          >
            <span className="font-medium text-slate-500 min-w-16">Giá bán:</span>
            <span className="font-bold text-red-600 text-sm">{cleanVal}</span>
          </div>,
        );
        continue;
      }
      if (kLower.includes('màu')) {
        nodes.push(
          <div
            key={`kv-${i}`}
            className="flex items-center gap-2 text-xs py-0.5 pl-2.5 ml-2 border-l-2 border-brand/40"
          >
            <span className="font-medium text-slate-500 min-w-16">Màu sắc:</span>
            <span className="text-slate-800 font-medium">{cleanVal}</span>
          </div>,
        );
        continue;
      }
      if (kLower.includes('size') || kLower.includes('cỡ')) {
        nodes.push(
          <div
            key={`kv-${i}`}
            className="flex items-center gap-2 text-xs py-0.5 pl-2.5 ml-2 border-l-2 border-brand/40"
          >
            <span className="font-medium text-slate-500 min-w-16">Kích cỡ:</span>
            <span className="text-slate-800 font-medium">{cleanVal}</span>
          </div>,
        );
        continue;
      }
      if (
        kLower.includes('lý do') ||
        kLower.includes('phù hợp') ||
        kLower.includes('nổi bật') ||
        kLower.includes('điểm')
      ) {
        nodes.push(
          <div
            key={`kv-${i}`}
            className="text-xs text-slate-600 bg-white/90 border border-slate-200/80 rounded-lg p-2 ml-2 mt-1 leading-relaxed"
          >
            <span className="font-semibold text-slate-700 block mb-0.5">💡 {key}:</span>
            <span className="italic">{renderInline(cleanVal)}</span>
          </div>,
        );
        continue;
      }

      nodes.push(
        <div
          key={`kv-${i}`}
          className="flex items-start gap-1.5 text-xs py-0.5 pl-2.5 ml-2 border-l-2 border-slate-200"
        >
          <span className="font-semibold text-slate-800 shrink-0">{key}:</span>
          <span className="text-slate-700">{renderInline(cleanVal)}</span>
        </div>,
      );
      continue;
    }

    // 3. Bullet line: "- item" or "* item" or "• item"
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const contentText = bulletMatch[1];
      // Check if bullet itself is a bold product name: "- **Áo Polo Regular...**"
      const boldProdMatch = contentText.match(/^\*\*([^*]+)\*\*$/);
      if (boldProdMatch) {
        const prod = findProductInSources(boldProdMatch[1], sources);
        if (prod) {
          nodes.push(
            <div
              key={`bullet-prod-${i}`}
              className="mt-3.5 first:mt-0 pt-2.5 first:pt-0 border-t border-slate-200/80 first:border-0"
            >
              <Link to={prod.url} className="font-bold text-slate-900 text-sm hover:text-brand no-underline">
                {prod.title}
              </Link>
            </div>,
          );
          continue;
        }
      }

      nodes.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 py-0.5 text-xs sm:text-sm text-slate-700">
          <span className="text-brand shrink-0 mt-0.5 font-bold">•</span>
          <span className="flex-1 leading-relaxed">{renderInline(contentText)}</span>
        </div>,
      );
      continue;
    }

    // 4. Regular paragraph
    nodes.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-slate-800 leading-relaxed mb-1.5 last:mb-0">
        {renderInline(trimmed)}
      </p>,
    );
  }

  return <div className="space-y-1">{nodes}</div>;
}

const CHAT_STORAGE_KEY = 'fashionhub_active_chat_messages';
const CHAT_CONVO_KEY = 'fashionhub_active_conversation_id';

function useChatSession() {
  const userId = useAuthStore((state) => state.user?.id ?? 'guest');
  const conversationKey = `${CHAT_CONVO_KEY}:${userId}`;
  const storageKey = `${CHAT_STORAGE_KEY}:${userId}`;
  const [conversationId, setConversationId] = useState<string>(() => {
    const storedId = readLocal<string>(conversationKey, '');
    if (storedId) return storedId;
    const newId = crypto.randomUUID();
    writeLocal(conversationKey, newId);
    return newId;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return readLocal<ChatMessage[]>(storageKey, []);
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedId = readLocal<string>(conversationKey, '');
    const nextId = storedId || crypto.randomUUID();
    if (!storedId) writeLocal(conversationKey, nextId);
    setConversationId(nextId);
    setMessages(readLocal<ChatMessage[]>(storageKey, []));
    setError('');
  }, [conversationKey, storageKey]);

  // Persist messages whenever state updates
  useEffect(() => {
    writeLocal(storageKey, messages);
  }, [messages, storageKey]);

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
    setMessages((items) => {
      const next = [...items, question];
      writeLocal(storageKey, next);
      return next;
    });
    setPending(true);
    try {
      const answer = await chatService.send(content, conversationId);
      setMessages((items) => {
        const next = [...items, answer];
        writeLocal(storageKey, next);
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể gửi câu hỏi.');
    } finally {
      setPending(false);
    }
  };

  const reset = () => {
    const newId = crypto.randomUUID();
    writeLocal(conversationKey, newId);
    writeLocal(storageKey, []);
    setConversationId(newId);
    setMessages([]);
    setError('');
  };

  return { messages, pending, error, send, reset };
}
function ChatPanel({ expanded = false }: { expanded?: boolean }) {
  const { messages, pending, error, send, reset } = useChatSession();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, pending]);

  return (
    <div className={`chat-panel ${expanded ? 'chat-expanded' : ''}`}>
      <div className="bg-ink text-white p-4 flex items-center justify-between shadow-sm pr-12">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
            <Bot size={18} />
          </div>
          <div>
            <strong className="block text-sm font-bold">Trợ lý FashionHub</strong>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Gợi ý trang phục dành cho bạn</span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            title="Làm mới cuộc trò chuyện"
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg transition"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-50/50">
        {!messages.length && (
          <div className="text-sm text-slate-600 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <p className="font-bold text-ink mb-1">Xin chào! Mình có thể giúp gì?</p>
            <p className="text-xs text-slate-500">Hỏi về sản phẩm, chọn size, giao hàng hoặc đổi trả.</p>
            <div className="flex flex-wrap gap-2 mt-3.5">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void send(prompt)}
                  className="border border-brand/30 text-brand bg-white rounded-full px-3 py-1.5 text-xs font-medium hover:bg-orange-50 hover:border-brand transition shadow-sm"
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
            {message.role === 'USER' ? (
              <p className="leading-relaxed">{message.content}</p>
            ) : (
              <FormattedChatMessage content={message.content} sources={message.sources} />
            )}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 space-y-2 w-full min-w-0 overflow-hidden">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Nguồn tham khảo:
                </span>
                <div className="grid grid-cols-1 gap-2 w-full min-w-0">
                  {message.sources.map((source, idx) => {
                    const cardContent = (
                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/90 shadow-sm hover:border-brand/60 hover:bg-orange-50/30 hover:shadow transition-all duration-150 group text-left w-full min-w-0 overflow-hidden box-border">
                        {source.imageUrl ? (
                          <img
                            src={source.imageUrl}
                            alt={source.title}
                            className="w-10 h-10 object-cover rounded-lg shrink-0 border border-slate-100 bg-slate-50 shadow-sm group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/images/product-placeholder.svg';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                            <BookOpen size={16} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-brand transition">
                            {source.citation ? `[${source.citation}] ` : ''}{source.title}
                          </p>
                          {source.excerpt && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {source.excerpt}
                            </p>
                          )}
                        </div>
                        <div className="text-slate-300 group-hover:text-brand group-hover:translate-x-0.5 transition-all duration-150 shrink-0">
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    );

                    return source.url ? (
                      source.url.startsWith('/') ? (
                        <Link
                          key={source.documentId || idx}
                          to={source.url}
                          className="block w-full min-w-0 no-underline"
                        >
                          {cardContent}
                        </Link>
                      ) : (
                        <a
                          key={source.documentId || idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full min-w-0 no-underline"
                        >
                          {cardContent}
                        </a>
                      )
                    ) : (
                      <div key={source.documentId || idx} className="w-full min-w-0">{cardContent}</div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {pending && <div className="chat-message-bot text-slate-500">Đang trả lời...</div>}
        {error && <p className="field-error text-sm">{error}</p>}
        <div ref={messagesEndRef} />
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
        aria-label={open ? 'Đóng tư vấn' : 'Mở tư vấn mua sắm'}
        className="chat-fab"
      >
        <MessageCircle size={23} />
        <span className="hidden sm:inline">Tư vấn mua sắm</span>
      </button>
    </div>
  );
}
export function ChatPage() {
  return (
    <div className="container-shell py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <span className="eyebrow text-brand">TRỢ LÝ MUA SẮM</span>
          <h1 className="text-3xl font-bold">Trợ lý mua sắm</h1>
          <p className="text-slate-500 mt-2">
            Hỏi về sản phẩm, cách phối đồ hoặc chính sách mua hàng.
          </p>
        </div>
        <ChatPanel expanded />
      </div>
    </div>
  );
}
