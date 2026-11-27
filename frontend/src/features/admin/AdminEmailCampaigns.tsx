import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bold, Image, Italic, List, Mail, Monitor, Send, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import { PageHeading } from '../../components/common';
import { httpClient } from '../../services/httpClient';

type Group = 'ALL' | 'REGISTERED' | 'NEWSLETTER';
type Recipient = { email: string; fullName: string | null; audience: Exclude<Group, 'ALL'> };
type Audience = { items: Recipient[]; counts: { registered: number; newsletter: number }; total: number; configured: boolean };
type Campaign = {
  id: string; subject: string; createdAt: string; total: number; pending: number;
  accepted: number; failed: number; skipped: number; lastError: string | null;
};

const emptyContent = { subject: '', preheader: '', title: '', body: '', imageUrl: '', imageAlt: '', buttonText: '', buttonUrl: '' };
const groups: Record<Group, string> = {
  ALL: 'Tất cả người đăng ký nhận tin',
  REGISTERED: 'Khách có tài khoản',
  NEWSLETTER: 'Khách chỉ đăng ký bản tin',
};

function imageSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function previewBody(value: string) {
  return value.trim().replace(/^- /gm, '• ')
    .split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/)
    .map((part, index) => {
      if (index % 2 === 0) return part;
      if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
      return <em key={index}>{part.slice(1, -1)}</em>;
    });
}

export function AdminEmailCampaigns() {
  const client = useQueryClient();
  const [content, setContent] = useState(emptyContent);
  const [group, setGroup] = useState<Group>('ALL');
  const [mode, setMode] = useState<'group' | 'selected'>('group');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [mobile, setMobile] = useState(false);
  const [reviewId, setReviewId] = useState('');
  const [notice, setNotice] = useState('');
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const recipients = useQuery({
    queryKey: ['campaign-recipients', group, search, page],
    queryFn: async () => (await httpClient.get<{ data: Audience }>('/admin/email/recipients', {
      params: { group, page, q: search },
    })).data.data,
  });
  const history = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => (await httpClient.get<{ data: Campaign[] }>('/admin/email/campaigns')).data.data,
    refetchInterval: query => query.state.data?.some(campaign => campaign.pending > 0) ? 3000 : false,
  });
  const send = useMutation({
    mutationFn: () => httpClient.post('/admin/email/campaigns', {
      id: reviewId, content, group, emails: mode === 'selected' ? selected : null,
    }),
    onSuccess: () => {
      setNotice('Đã đưa chiến dịch vào hàng đợi gửi.');
      setReviewId('');
      setContent(emptyContent);
      setSelected([]);
      void client.invalidateQueries({ queryKey: ['email-campaigns'] });
    },
  });

  const data = recipients.data;
  const count = mode === 'selected' ? selected.length : group === 'ALL'
    ? (data?.counts.registered ?? 0) + (data?.counts.newsletter ?? 0)
    : (group === 'REGISTERED' ? data?.counts.registered : data?.counts.newsletter) ?? 0;
  const message = send.error?.message;
  const photo = imageSource(content.imageUrl);
  const formatBody = (style: 'bold' | 'italic' | 'list') => {
    const input = bodyInput.current;
    if (!input) return;
    let { selectionStart: start, selectionEnd: end } = input;
    if (style === 'list') {
      start = content.body.lastIndexOf('\n', start - 1) + 1;
      const nextLine = content.body.indexOf('\n', end);
      end = nextLine < 0 ? content.body.length : nextLine;
    }
    const current = content.body.slice(start, end);
    const marker = style === 'bold' ? '**' : '*';
    const formatted = style === 'list'
      ? (current || 'Mục danh sách').replace(/^(?!- )/gm, '- ')
      : marker + (current || 'Nội dung') + marker;
    const body = content.body.slice(0, start) + formatted + content.body.slice(end);
    if (body.length > 8000) return;
    setContent({ ...content, body });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start, start + formatted.length);
    });
  };
  const field = (name: keyof typeof emptyContent, label: string, maxLength: number, required = false, type = 'text') => (
    <label className="form-label">{label}
      <input className="field mt-1" type={type} maxLength={maxLength} required={required}
        value={content[name]} onChange={event => setContent({ ...content, [name]: event.target.value })} />
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeading title="Chiến dịch email" description="Soạn bản tin, chọn người nhận và theo dõi tiến độ gửi." />
      {data && !data.configured && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Dịch vụ gửi email chưa sẵn sàng. Kiểm tra địa chỉ gửi đã xác minh trong cấu hình Resend.
      </p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
      <form onSubmit={event => {
        event.preventDefault();
        send.reset();
        setNotice('');
        setReviewId(crypto.randomUUID());
      }}>
        <fieldset disabled={!!reviewId} className="grid gap-6 xl:grid-cols-2">
          <section className="panel min-w-0 space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Mail size={19} /> Nội dung email</h2>
            {field('subject', 'Tiêu đề email', 150, true)}
            {field('preheader', 'Dòng xem trước trong hộp thư', 160)}
            {field('title', 'Tiêu đề trong email', 120, true)}
            <div>
              <label htmlFor="campaign-body" className="form-label">Nội dung</label>
              <div className="mt-1 flex gap-1 rounded-t border border-b-0 border-slate-200 bg-slate-50 p-1.5">
                <button type="button" className="p-1.5" title="In đậm" aria-label="In đậm" onClick={() => formatBody('bold')}><Bold size={16} /></button>
                <button type="button" className="p-1.5" title="In nghiêng" aria-label="In nghiêng" onClick={() => formatBody('italic')}><Italic size={16} /></button>
                <button type="button" className="p-1.5" title="Danh sách" aria-label="Danh sách" onClick={() => formatBody('list')}><List size={16} /></button>
              </div>
              <textarea ref={bodyInput} id="campaign-body" className="field min-h-36" maxLength={8000} required
                value={content.body} onChange={event => setContent({ ...content, body: event.target.value })} />
            </div>
            <div className="rounded border border-slate-200 p-4 space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold"><Image size={16} /> Ảnh bìa</h3>
              {field('imageUrl', 'Liên kết ảnh công khai (HTTPS)', 2048, false, 'url')}
              {content.imageUrl && field('imageAlt', 'Mô tả ảnh', 150, true)}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('buttonText', 'Nhãn nút trong email', 50, !!content.buttonUrl)}
              {field('buttonUrl', 'Liên kết của nút (HTTPS)', 2048, !!content.buttonText, 'url')}
            </div>
          </section>
          <section className="panel min-w-0 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Xem trước</h2>
              <div className="flex gap-2">
                <button type="button" aria-label="Xem trên máy tính" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={20} /></button>
                <button type="button" aria-label="Xem trên điện thoại" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={20} /></button>
              </div>
            </div>
            <div className="rounded bg-neutral-100 p-3 sm:p-5">
              <article className={`mx-auto bg-white break-words ${mobile ? 'max-w-[330px]' : 'max-w-[600px]'}`}>
                <header className="border-b p-4 text-sm">
                  <p className="font-bold">{content.subject || 'Tiêu đề email'}</p>
                  {content.preheader && <p className="mt-1 text-slate-500">{content.preheader}</p>}
                </header>
                <div className="bg-ink px-6 py-4 text-lg font-bold text-white">FASHIONHUB</div>
                {photo && <img className="w-full" src={photo} alt={content.imageAlt} referrerPolicy="no-referrer" />}
                <div className="space-y-4 p-6">
                  <h3 className="text-2xl font-bold">{content.title || 'Tiêu đề trong email'}</h3>
                  <p className="whitespace-pre-wrap text-sm leading-7">{content.body.trim() ? previewBody(content.body) : 'Nội dung bản tin sẽ hiện ở đây.'}</p>
                  {content.buttonText && <span className="btn-primary inline-flex">{content.buttonText}</span>}
                </div>
                <footer className="bg-neutral-200 p-4 text-xs text-neutral-700">Bạn nhận email này vì đã đăng ký bản tin FashionHub. <span className="underline">Hủy đăng ký</span></footer>
              </article>
            </div>
          </section>

          <section className="panel min-w-0 space-y-4 xl:col-span-2">
            <h2 className="text-lg font-bold">Người nhận</h2>
            <p className="text-sm text-slate-600">Danh sách gồm những khách đã đăng ký nhận bản tin FashionHub.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">Nhóm khách
                <select className="field mt-1" value={group} onChange={event => {
                  setGroup(event.target.value as Group); setPage(1); setSelected([]);
                }}>{Object.entries(groups).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
              </label>
              <label className="form-label">Cách chọn
                <select className="field mt-1" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
                  <option value="group">Gửi cho cả nhóm</option><option value="selected">Chọn từng người</option>
                </select>
              </label>
            </div>
            {mode === 'selected' && <>
              <input className="field" type="search" aria-label="Tìm người nhận" maxLength={255}
                placeholder="Tìm theo tên hoặc email" value={search}
                onChange={event => { setSearch(event.target.value); setPage(1); }} />
              <div className="divide-y max-h-72 overflow-auto rounded border px-4">
                {data?.items.map(person => (
                  <label key={person.email} className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                    <input type="checkbox" checked={selected.includes(person.email)}
                      disabled={!selected.includes(person.email) && selected.length >= 1000}
                      onChange={event => setSelected(event.target.checked
                        ? [...selected, person.email] : selected.filter(email => email !== person.email))} />
                    <span className="break-all">{person.fullName && <strong className="mr-2">{person.fullName}</strong>}{person.email}</span>
                    <span className="ml-auto text-xs text-slate-500">{groups[person.audience]}</span>
                  </label>
                ))}
                {data?.items.length === 0 && <p className="py-3 text-sm text-slate-500">Chưa tìm thấy người nhận.</p>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button>
                <span>Trang {page}</span>
                <button type="button" className="btn-outline" disabled={page * 50 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>Trang sau</button>
              </div>
            </>}
            {recipients.isError && <p role="alert" className="field-error">{recipients.error.message}</p>}
            {recipients.isLoading && <p role="status" className="text-sm">Đang tải người nhận…</p>}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm"><strong>{count.toLocaleString('vi-VN')}</strong> người nhận</p>
              <button className="btn-primary" disabled={!data?.configured || count === 0}>Duyệt trước khi gửi</button>
            </div>
          </section>
        </fieldset>
      </form>
      {reviewId && <section aria-label="Xác nhận gửi email" className="panel space-y-3">
        <h2 className="text-lg font-bold">Gửi chiến dịch này?</h2>
        <p className="text-sm">Email <strong>{content.subject}</strong> sẽ được gửi đến {count.toLocaleString('vi-VN')} người nhận.</p>
        {message && <p role="alert" className="field-error">{message}</p>}
        <div className="flex gap-3">
          <button className="btn-outline" disabled={send.isPending} onClick={() => setReviewId('')}>Quay lại chỉnh sửa</button>
          <button className="btn-primary" disabled={send.isPending} onClick={() => send.mutate()}>
            <Send size={16} /> {send.isPending ? 'Đang lên lịch gửi…' : 'Xác nhận gửi'}
          </button>
        </div>
      </section>}
      <section className="panel space-y-4">
        <h2 className="text-lg font-bold">Lịch sử gửi</h2>
        {history.isError && <p role="alert" className="field-error">{history.error.message}</p>}
        {history.data?.length === 0 && <p className="text-sm text-slate-500">Chưa có chiến dịch nào.</p>}
        {history.data?.map(campaign => (
          <article key={campaign.id} className="space-y-1 border-t py-3">
            <p className="font-bold">{campaign.subject}</p>
            <p className="text-sm text-slate-600">
              {campaign.total} người nhận · Resend đã tiếp nhận {campaign.accepted} · Đang xử lý {campaign.pending}
              {' · '}Bỏ qua {campaign.skipped} · Gửi lỗi {campaign.failed}
            </p>
            {campaign.lastError && <p className="text-xs text-red-700">{campaign.lastError}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
