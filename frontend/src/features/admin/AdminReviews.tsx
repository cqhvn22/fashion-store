import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { reviewService } from '../../services/reviews';
import { reviewImageUrl } from '../../components/ReviewEditor';
import type { ProductReview } from '../../types/models';

export function AdminReviews() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProductReview | null>(null);
  const [reply, setReply] = useState('');
  const client = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-reviews', page], queryFn: () => reviewService.adminList(page) });
  const visibility = useMutation({
    mutationFn: (review: ProductReview) => reviewService.setVisibility(review.id, review.status === 'HIDDEN'),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['admin-reviews'] }); void client.invalidateQueries({ queryKey: ['reviews'] }); void client.invalidateQueries({ queryKey: ['products'] }); },
  });
  const respond = useMutation({
    mutationFn: () => reviewService.reply(selected!.id, reply.trim()),
    onSuccess: () => { setSelected(null); void client.invalidateQueries({ queryKey: ['admin-reviews'] }); void client.invalidateQueries({ queryKey: ['reviews'] }); },
  });
  return <div className="p-5 lg:p-8">
    <div className="mb-6"><p className="text-xs text-brand font-bold uppercase tracking-wider">Phản hồi khách hàng</p><h1 className="text-3xl font-black uppercase">Đánh giá sản phẩm</h1><p className="text-sm text-slate-500 mt-2">Xem nhận xét đã mua hàng, phản hồi hoặc ẩn nội dung không phù hợp.</p></div>
    {isLoading ? <p>Đang tải đánh giá...</p> : error ? <p role="alert" className="field-error">{error.message}</p> : !data?.content.length ? <div className="bg-white border p-8 text-slate-500">Chưa có đánh giá nào.</div> : <div className="space-y-3">
      {data.content.map((review) => <article key={review.id} className="bg-white border p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><strong>{review.productName ?? review.productId}</strong><p className="text-xs text-slate-500 mt-1">{review.reviewerName} · {review.color} / {review.size} · {new Date(review.createdAt).toLocaleDateString('vi-VN')}</p></div><span className={review.status === 'HIDDEN' ? 'text-slate-500 text-xs' : 'text-emerald-700 text-xs'}>{review.status === 'HIDDEN' ? 'Đã ẩn' : 'Đang hiển thị'}</span></div>
        <div className="flex gap-0.5 mt-3">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} className={star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />)}</div>
        <p className="text-sm whitespace-pre-wrap mt-3">{review.content}</p>
        {!!review.images?.length && <div className="flex flex-wrap gap-2 mt-3">{review.images.map((url) => <img key={url} src={reviewImageUrl(url)} alt="Ảnh đánh giá" className="w-16 h-16 object-cover border" />)}</div>}
        {review.sellerReply && <p className="text-sm bg-slate-50 p-3 mt-3"><strong>Phản hồi:</strong> {review.sellerReply}</p>}
        <div className="flex gap-2 mt-4"><button type="button" className="btn-outline text-xs" disabled={visibility.isPending} onClick={() => visibility.mutate(review)}>{review.status === 'HIDDEN' ? 'Hiển thị lại' : 'Ẩn đánh giá'}</button><button type="button" className="btn-outline text-xs" onClick={() => { setSelected(review); setReply(review.sellerReply ?? ''); }}>Phản hồi</button></div>
      </article>)}
    </div>}
    {visibility.error && <p role="alert" className="field-error mt-3">{visibility.error.message}</p>}
    {data && data.totalPages > 1 && <div className="flex items-center gap-3 mt-6"><button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page} / {data.totalPages}</span><button type="button" className="btn-outline" disabled={data.last} onClick={() => setPage(page + 1)}>Sau</button></div>}
    {selected && <div className="fixed inset-0 z-[100] bg-black/60 grid place-items-center p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-label="Phản hồi đánh giá" className="bg-white w-full max-w-lg p-6"><h2 className="text-xl font-bold mb-4">Phản hồi đánh giá</h2><p className="text-sm text-slate-600 mb-4">{selected.content}</p><textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={1000} rows={5} className="field w-full" placeholder="Viết phản hồi cho khách hàng..." /><p className="text-xs text-slate-500 text-right">{reply.trim().length}/1000</p>{respond.error && <p role="alert" className="field-error mt-2">{respond.error.message}</p>}<div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-outline" onClick={() => setSelected(null)}>Đóng</button><button type="button" className="btn-primary" disabled={respond.isPending || reply.trim().length < 2} onClick={() => respond.mutate()}>Gửi phản hồi</button></div></section></div>}
  </div>;
}
