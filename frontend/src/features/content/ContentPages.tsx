import { Link } from 'react-router-dom';
import { PageHeading } from '../../components/common';
const content: Record<string, { title: string; paragraphs: string[] }> = {
  about: {
    title: 'Về FashionHub',
    paragraphs: [
      'FashionHub là cửa hàng thời trang demo cho đồ án thương mại điện tử tích hợp AI/RAG.',
      'Chúng tôi chọn các thiết kế dễ mặc, phối linh hoạt và phù hợp nhiều nhịp sống.',
    ],
  },
  contact: {
    title: 'Liên hệ',
    paragraphs: [
      'Đây là website demo. Kênh hỗ trợ thật sẽ được bổ sung khi có Backend và thông tin cửa hàng chính thức.',
      'Bạn có thể thử trò chuyện với trợ lý AI để hỏi về chính sách và sản phẩm mẫu.',
    ],
  },
  shipping: {
    title: 'Chính sách giao hàng',
    paragraphs: [
      'Phí giao hàng demo là 30.000₫. Đơn từ 500.000₫ được miễn phí vận chuyển.',
      'Thời gian giao hàng tham khảo 2–5 ngày. Thông tin cuối cùng cần xác nhận bởi đơn vị vận chuyển và Backend.',
    ],
  },
  returns: {
    title: 'Chính sách đổi trả',
    paragraphs: [
      'Hỗ trợ đổi size trong 7 ngày nếu sản phẩm còn nguyên tem và chưa qua sử dụng.',
      'Chính sách này là dữ liệu minh họa cho bản demo.',
    ],
  },
  privacy: {
    title: 'Chính sách bảo mật',
    paragraphs: [
      'Bản demo lưu giỏ hàng, tài khoản và đơn hàng mẫu trong trình duyệt của bạn.',
      'Khi kết nối Backend, chính sách xử lý dữ liệu và bảo mật sẽ được cập nhật theo hệ thống thực tế.',
    ],
  },
  'size-guide': {
    title: 'Hướng dẫn chọn size',
    paragraphs: [
      'Size S tham khảo cho 45–52 kg, M cho 53–62 kg và L cho 63–72 kg.',
      'Hãy đối chiếu số đo cơ thể và phom sản phẩm để chọn size vừa nhất.',
    ],
  },
};
export function ContentPage({ name }: { name: keyof typeof content }) {
  const item = content[name];
  return (
    <div className="container-shell py-12">
      <div className="max-w-3xl mx-auto panel">
        <PageHeading eyebrow="FASHIONHUB" title={item.title} />
        {item.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-slate-600 leading-8 mb-4">
            {paragraph}
          </p>
        ))}
        <Link to="/products" className="text-brand font-semibold">
          Khám phá sản phẩm →
        </Link>
      </div>
    </div>
  );
}
export function StatusPage({ code }: { code: '403' | '404' | '500' }) {
  const title =
    code === '403'
      ? 'Bạn không có quyền truy cập'
      : code === '404'
        ? 'Không tìm thấy trang'
        : 'Hệ thống tạm thời gặp lỗi';
  return (
    <div className="container-shell py-20 text-center">
      <div className="text-7xl font-black text-brand mb-4">{code}</div>
      <h1 className="text-2xl font-bold mb-3">{title}</h1>
      <p className="text-slate-500 mb-6">Hãy quay lại trang chủ hoặc tiếp tục khám phá cửa hàng.</p>
      <Link to="/" className="btn-primary inline-block">
        Về trang chủ
      </Link>
    </div>
  );
}
