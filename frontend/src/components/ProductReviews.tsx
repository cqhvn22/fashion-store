import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { reviewService } from '../services/reviews';
import { reviewImageUrl } from './ReviewEditor';

export function ProductReviews({ productId }: { productId: string }) {
  const [rating, setRating] = useState<number | undefined>();
  const [withImages, setWithImages] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ['reviews', productId, page, rating, withImages],
    queryFn: () => reviewService.product(productId, page, rating, withImages),
  });
  const counts = data?.starCounts ?? {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const average = total ? Object.entries(counts).reduce((sum, [star, count]) => sum + Number(star) * count, 0) / total : 0;
  return <section id="reviews" className="mt-16 border-t border-[#e5e5e5] pt-10">
    <h2 className="text-xl font-bold uppercase tracking-wide">Đánh giá sản phẩm</h2>
    <div className="flex flex-wrap items-center gap-3 mt-5 mb-6 p-5 bg-[#fafafa] border border-[#eee]">
      <strong className="text-3xl text-brand">{average.toFixed(1)}<span className="text-base font-normal"> / 5</span></strong>
      <Star size={22} className="fill-amber-400 text-amber-400" /><span className="text-sm text-slate-600">{total} đánh giá từ khách đã mua</span>
    </div>
    <div className="flex flex-wrap gap-2 mb-6">
      <button type="button" className={rating === undefined ? 'btn-primary' : 'btn-outline'} onClick={() => { setRating(undefined); setPage(1); }}>Tất cả ({total})</button>
      {[5, 4, 3, 2, 1].map((star) => <button key={star} type="button" className={rating === star ? 'btn-primary' : 'btn-outline'} onClick={() => { setRating(star); setPage(1); }}>{star} sao ({counts[String(star)] ?? 0})</button>)}
      <label className="flex items-center gap-2 text-sm px-3"><input type="checkbox" checked={withImages} onChange={(event) => { setWithImages(event.target.checked); setPage(1); }} />Có hình ảnh</label>
    </div>
    {isLoading ? <p className="text-sm text-slate-500">Đang tải đánh giá...</p> : error ? <p role="alert" className="text-sm text-brand">{error.message}</p> : !data?.content.length ? <p className="text-sm text-slate-500 py-8 border-t">Chưa có đánh giá phù hợp.</p> : <div className="divide-y border-t">
      {data.content.map((review) => <article key={review.id} className="py-6">
        <div className="flex items-center gap-2"><strong className="text-sm">{review.reviewerName}</strong><span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5">Đã mua hàng</span></div>
        <div className="flex gap-0.5 mt-2">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} className={star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />)}</div>
        <p className="text-xs text-slate-500 mt-2">{review.color} / {review.size} · {new Date(review.createdAt).toLocaleDateString('vi-VN')}</p>
        <p className="text-sm mt-3 whitespace-pre-wrap">{review.content}</p>
        {!!review.images?.length && <div className="flex flex-wrap gap-2 mt-3">{review.images.map((url) => <a href={reviewImageUrl(url)} target="_blank" rel="noreferrer" key={url}><img src={reviewImageUrl(url)} alt="Ảnh từ khách mua hàng" className="w-24 h-24 object-cover border" /></a>)}</div>}
        {review.sellerReply && <div className="bg-[#fafafa] p-4 mt-4 text-sm"><strong>Phản hồi từ cửa hàng</strong><p className="mt-1">{review.sellerReply}</p></div>}
      </article>)}
    </div>}
    {data && data.totalPages > 1 && <div className="flex items-center justify-center gap-4 mt-6"><button type="button" className="btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span className="text-sm">{page} / {data.totalPages}</span><button type="button" className="btn-outline" disabled={data.last} onClick={() => setPage(page + 1)}>Sau</button></div>}
  </section>;
}
