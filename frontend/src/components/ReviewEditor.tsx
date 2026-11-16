import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Star, X } from 'lucide-react';
import type { OrderItem, ProductReview } from '../types/models';
import { reviewService } from '../services/reviews';
import { uploadReviewImage } from '../services/media';

export function reviewImageUrl(url: string): string {
  return url.startsWith('/api/v1/')
    ? `${(import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/api\/v1\/?$/, '')}${url}`
    : url;
}

export function ReviewEditor({ item, existing, onClose }: {
  item: OrderItem;
  existing?: ProductReview;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [content, setContent] = useState(existing?.content ?? '');
  const [images, setImages] = useState<string[]>(existing?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState('');
  const { data: eligibility, isLoading } = useQuery({
    queryKey: ['review-eligibility', item.id],
    queryFn: () => reviewService.eligibility(item.id),
  });
  const review = eligibility?.review ?? existing;
  const canEdit = review ? review.canEdit : eligibility?.eligible;
  useEffect(() => {
    if (eligibility?.review && !existing) {
      setRating(eligibility.review.rating);
      setContent(eligibility.review.content);
      setImages(eligibility.review.images ?? []);
    }
  }, [eligibility?.review, existing]);
  const mutation = useMutation({
    mutationFn: () => {
      const draft = { orderItemId: item.id, rating, content: content.trim(), imageUrls: images };
      return review ? reviewService.edit(review.id, draft) : reviewService.create(draft);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['my-reviews'] });
      void client.invalidateQueries({ queryKey: ['reviews', item.productId] });
      void client.invalidateQueries({ queryKey: ['review-eligibility', item.id] });
      void client.invalidateQueries({ queryKey: ['products'] });
      void client.invalidateQueries({ queryKey: ['product'] });
      onClose();
    },
  });
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  const submit = () => {
    if (!rating) { setLocalError('Vui lòng chọn số sao.'); return; }
    if (content.trim().length < 10 || content.trim().length > 2000) {
      setLocalError('Nhận xét cần từ 10 đến 2.000 ký tự.'); return;
    }
    setLocalError('');
    mutation.mutate();
  };
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    if (images.length + files.length > 5) { setLocalError('Tối đa 5 ảnh cho mỗi đánh giá.'); return; }
    setUploading(true); setLocalError('');
    try {
      const urls = await Promise.all(Array.from(files).map(uploadReviewImage));
      setImages((current) => [...current, ...urls]);
    } catch (error) { setLocalError(error instanceof Error ? error.message : 'Không tải được ảnh.'); }
    finally { setUploading(false); }
  };
  return (
    <div role="presentation" className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Đánh giá sản phẩm" className="bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-sm p-5 sm:p-7 shadow-xl">
        <div className="flex justify-between items-start gap-3 mb-5">
          <div><h2 className="text-xl font-bold">{review ? 'Đánh giá của bạn' : 'Đánh giá sản phẩm'}</h2><p className="text-sm text-slate-500 mt-1">{item.productName} · {item.color} / {item.size}</p></div>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={22} /></button>
        </div>
        {isLoading ? <p>Đang kiểm tra đơn hàng...</p> : !canEdit ? (
          <p className="text-sm text-slate-600">{review ? 'Đánh giá này đã hết lượt chỉnh sửa hoặc quá thời hạn.' : 'Sản phẩm chưa đủ điều kiện đánh giá hoặc đã hết thời hạn 30 ngày sau khi giao.'}</p>
        ) : <>
          <p className="text-sm font-semibold mb-2">Chất lượng sản phẩm</p>
          <div className="flex gap-2 mb-5" aria-label="Chọn số sao">
            {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} sao`} onClick={() => setRating(star)} className="p-1"><Star size={30} className={star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>)}
          </div>
          <label htmlFor="review-content" className="text-sm font-semibold block mb-2">Nhận xét của bạn</label>
          <textarea id="review-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={5} placeholder="Chia sẻ cảm nhận về chất liệu, kích cỡ và trải nghiệm sử dụng..." className="w-full border border-slate-300 p-3 text-sm focus:outline-none focus:border-brand" />
          <p className="text-xs text-slate-500 text-right">{content.trim().length}/2000 ký tự</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {images.map((url) => <div key={url} className="relative"><img src={reviewImageUrl(url)} alt="Ảnh đánh giá" className="w-20 h-20 object-cover border" /><button type="button" aria-label="Xóa ảnh" className="absolute -top-2 -right-2 bg-white rounded-full shadow" onClick={() => setImages((current) => current.filter((image) => image !== url))}><X size={16} /></button></div>)}
            {images.length < 5 && <label className="w-20 h-20 border border-dashed border-slate-400 flex flex-col items-center justify-center text-xs text-slate-600 cursor-pointer"><ImagePlus size={20} /><span>Thêm ảnh</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(event) => { void addImages(event.target.files); event.target.value = ''; }} /></label>}
          </div>
          <p className="text-xs text-slate-500 mt-2">Tối đa 5 ảnh JPG, PNG hoặc WebP; mỗi ảnh tối đa 5 MB.</p>
          {review && <p className="text-xs text-slate-500 mt-3">Bạn được chỉnh sửa một lần trong 30 ngày từ khi đăng đánh giá.</p>}
          {(localError || mutation.error) && <p role="alert" className="field-error mt-3">{localError || mutation.error?.message}</p>}
          <div className="flex justify-end gap-2 mt-6"><button type="button" className="btn-outline" onClick={onClose}>Đóng</button><button type="button" className="btn-primary" disabled={uploading || mutation.isPending} onClick={submit}>{mutation.isPending ? 'Đang gửi...' : review ? 'Lưu chỉnh sửa' : 'Gửi đánh giá'}</button></div>
        </>}
      </section>
    </div>
  );
}
