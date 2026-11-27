import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../../components/common';
import { httpClient } from '../../services/httpClient';

export function NewsletterUnsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const valid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(token);
  const unsubscribe = useMutation({
    mutationFn: () => httpClient.post(`/newsletter/unsubscribe/${token}`),
  });

  return (
    <div className="container-shell max-w-lg py-12">
      <div className="panel space-y-4">
        <PageHeading title="Hủy đăng ký bản tin" />
        {unsubscribe.isSuccess ? <p role="status">Bạn đã hủy đăng ký nhận bản tin FashionHub.</p> : valid ? (
          <>
            <p className="text-sm text-slate-600">Xác nhận để ngừng nhận bản tin qua email.</p>
            <button className="btn-primary" disabled={unsubscribe.isPending} onClick={() => unsubscribe.mutate()}>
              {unsubscribe.isPending ? 'Đang xử lý…' : 'Xác nhận hủy đăng ký'}
            </button>
          </>
        ) : <p role="alert" className="field-error">Liên kết hủy đăng ký không hợp lệ.</p>}
        {unsubscribe.isError && <p role="alert" className="field-error">{unsubscribe.error.message}</p>}
        <Link to="/" className="block text-sm text-brand">Về trang chủ</Link>
      </div>
    </div>
  );
}
