import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { EmptyState, ErrorState, PageHeading } from '../../components/common';
import { knowledgeService } from '../../services/chat';
import type { KnowledgeDocument } from '../../types/models';
import { formatDate } from '../../utils/format';

const statusLabel: Record<KnowledgeDocument['status'], string> = {
  INDEXED: 'Sẵn sàng', PENDING: 'Đang cập nhật', FAILED: 'Cần xử lý',
};

export function AdminKnowledgeManager() {
  const client = useQueryClient();
  const docsQuery = useQuery({ queryKey: ['knowledge'], queryFn: knowledgeService.list,
    refetchInterval: 5000 });
  const productQuery = useQuery({ queryKey: ['ai-product-index'], queryFn: knowledgeService.productStatus,
    refetchInterval: 5000 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [editing, setEditing] = useState<KnowledgeDocument | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const legacyImportStarted = useRef(false);
  useEffect(() => {
    if (!docsQuery.isSuccess || legacyImportStarted.current) return;
    legacyImportStarted.current = true;
    void knowledgeService.importLegacy().then(async (count) => {
      if (count > 0) {
        await client.invalidateQueries({ queryKey: ['knowledge'] });
        setMessage(`Đã chuyển ${count} tài liệu trước đây vào kho tri thức AI.`);
      }
    }).catch(() => setError('Chưa thể chuyển tài liệu cũ vào kho tri thức. Vui lòng thử tải lại trang.'));
  }, [docsQuery.isSuccess, client]);
  const docs = docsQuery.data ?? [];
  const visible = docs.filter((doc) =>
    (filter === 'ALL' || doc.status === filter || (filter === 'INACTIVE' && doc.isActive === false)) &&
    `${doc.title} ${doc.content}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
  const product = productQuery.data;
  const refreshing = !!(product?.running || product?.queued);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await action();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['knowledge'] }),
        client.invalidateQueries({ queryKey: ['ai-product-index'] }),
      ]);
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể thực hiện. Vui lòng thử lại.');
    } finally { setBusy(false); }
  };
  const openEditor = (doc?: KnowledgeDocument) => {
    setEditing(doc ?? null); setTitle(doc?.title ?? ''); setContent(doc?.content ?? '');
    setError(''); setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < 3 || title.trim().length > 250 ||
        content.trim().length < 10 || content.trim().length > 50000) {
      setError('Tiêu đề cần 3–250 ký tự và nội dung cần 10–50.000 ký tự.');
      return;
    }
    setBusy(true); setError('');
    try {
      await knowledgeService.save({ id: editing?.id ?? '', title: title.trim(),
        content: content.trim(), status: 'PENDING', updatedAt: new Date().toISOString() });
      setOpen(false);
      setMessage('Đã lưu. Trợ lý đang cập nhật nội dung mới.');
      await client.invalidateQueries({ queryKey: ['knowledge'] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể lưu tài liệu.');
    } finally { setBusy(false); }
  };

  return <>
    <PageHeading eyebrow="TRỢ LÝ MUA SẮM" title="Quản lý tri thức AI"
      description="Theo dõi dữ liệu sản phẩm và quản lý nội dung mà trợ lý dùng để tư vấn."
      action={<button className="btn-primary" onClick={() => openEditor()}>+ Thêm tài liệu</button>} />

    {message && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800">{message}</p>}
    {error && !open && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}

    <section className="panel mb-6" aria-label="Tri thức sản phẩm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Tri thức sản phẩm</h2>
          <p className="mt-1 text-sm text-slate-600">Đồng bộ sản phẩm từ cửa hàng và bộ dữ liệu sản phẩm cho trợ lý.</p>
        </div>
        <button className="btn-outline flex items-center gap-2"
          disabled={busy || refreshing || productQuery.isPending || productQuery.isError}
          onClick={() => void run(knowledgeService.refreshProducts,
            'Đã bắt đầu cập nhật tri thức sản phẩm. Số liệu sẽ tự làm mới.')}>
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Đang cập nhật…' : 'Cập nhật tri thức sản phẩm'}
        </button>
      </div>
      {productQuery.isPending ? <p className="mt-4 text-sm text-slate-600" role="status">Đang tải dữ liệu sản phẩm…</p> :
       productQuery.isError ? <div className="mt-4"><ErrorState error={productQuery.error} retry={() => void productQuery.refetch()} /></div> :
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Sản phẩm cửa hàng</p>
            <strong className="text-2xl">{product?.documents?.catalog ?? '—'}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Sản phẩm từ bộ dữ liệu</p>
            <strong className="text-2xl">{product?.documents?.workbook ?? '—'}</strong></div>
          <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Cập nhật gần nhất</p>
            <strong className="text-sm">{product?.last_sync ? formatDate(product.last_sync) : 'Chưa cập nhật'}</strong></div>
        </div>}
      {product?.error && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="alert">
        Một nguồn dữ liệu chưa cập nhật được: {product.error}</p>}
      {refreshing && <p className="mt-3 text-sm text-slate-600" role="status">Đang đối chiếu thay đổi và cập nhật thông tin sản phẩm…</p>}
    </section>

    <section className="panel" aria-label="Tài liệu tư vấn">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div><h2 className="text-lg font-bold">Tài liệu tư vấn</h2>
          <p className="text-sm text-slate-500">{docs.length} tài liệu · {docs.filter((doc) => doc.status === 'INDEXED' && doc.isActive !== false).length} đang sử dụng</p></div>
        <button className="btn-outline" onClick={() => void docsQuery.refetch()}>Làm mới</button>
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 flex-1 min-w-52">
          <Search size={17} className="text-slate-500" />
          <input className="w-full py-2 outline-none" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề hoặc nội dung" aria-label="Tìm tài liệu" />
        </label>
        <select className="field w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc trạng thái">
          <option value="ALL">Tất cả trạng thái</option><option value="INDEXED">Sẵn sàng</option>
          <option value="PENDING">Đang cập nhật</option><option value="FAILED">Cần xử lý</option>
          <option value="INACTIVE">Đã tạm ẩn</option>
        </select>
      </div>
      {docsQuery.isError ? <ErrorState error={docsQuery.error} retry={() => void docsQuery.refetch()} /> :
       visible.length === 0 ? <EmptyState title="Chưa có tài liệu phù hợp" /> :
       <div className="grid gap-3 md:grid-cols-2">
        {visible.map((doc) => <article key={doc.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-bold">{doc.title}</h3>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${doc.status === 'FAILED' ? 'bg-red-50 text-red-700' : doc.status === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{statusLabel[doc.status]}</span>
          </div>
          <p className="my-3 line-clamp-3 text-sm text-slate-600">{doc.content}</p>
          <p className="text-xs text-slate-500">{doc.isActive === false ? 'Đã tạm ẩn' : 'Đang hiển thị'} · {/^\s*(nếu|khi)\s+(user|khách|người dùng)\s+/i.test(doc.title) ? 'Quy tắc trả lời' : `${doc.chunkCount ?? 0} đoạn nội dung`} · Sửa {formatDate(doc.updatedAt)}</p>
          {doc.lastError && <p className="mt-2 text-xs text-red-700" title={doc.lastError}>Cập nhật chưa thành công: {doc.lastError}</p>}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
            <button className="text-slate-900 hover:underline" onClick={() => openEditor(doc)}>Chỉnh sửa</button>
            <button className="text-slate-900 hover:underline" disabled={busy || doc.status === 'PENDING'}
              onClick={() => void run(() => knowledgeService.reindex(doc.id), 'Đang cập nhật lại tài liệu.')}>Cập nhật lại</button>
            <button className="text-slate-900 hover:underline" disabled={busy}
              onClick={() => void run(() => knowledgeService.setActive(doc.id, doc.isActive === false),
                doc.isActive === false ? 'Đã sử dụng lại tài liệu.' : 'Đã tạm ẩn tài liệu.')}>{doc.isActive === false ? 'Sử dụng lại' : 'Tạm ẩn'}</button>
            <button className="text-red-700 hover:underline" disabled={busy} onClick={() => {
              if (window.confirm(`Xóa tài liệu “${doc.title}”?`))
                void run(() => knowledgeService.remove(doc.id), 'Đã xóa tài liệu.');
            }}>Xóa</button>
          </div>
        </article>)}
       </div>}
    </section>

    {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4" role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <form onSubmit={(event) => void save(event)} role="dialog" aria-modal="true" aria-label={editing ? 'Sửa tài liệu' : 'Thêm tài liệu'}
        className="mx-auto mt-10 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-xl font-bold">{editing ? 'Sửa tài liệu' : 'Thêm tài liệu'}</h2>
        <label className="form-label">Tiêu đề<input className="field" maxLength={250} value={title}
          onChange={(event) => setTitle(event.target.value)} required /></label>
        <label className="form-label mt-4">Nội dung<textarea className="field min-h-64" maxLength={50000}
          value={content} onChange={(event) => setContent(event.target.value)} required /></label>
        <p className="mt-2 text-xs text-slate-500">Nội dung sẽ được trợ lý dùng sau khi cập nhật xong. Để đặt câu trả lời cố định, ví dụ: tiêu đề “Nếu user nói hello”, nội dung “Trả lời là Hello world”.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-outline" disabled={busy}
          onClick={() => setOpen(false)}>Hủy</button><button className="btn-primary" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu tài liệu'}</button></div>
      </form>
    </div>}
  </>;
}
