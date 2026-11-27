import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Gift, Sparkles, Truck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { httpClient, hasAccessToken, useDbAuth } from '../../services/httpClient';
import { PageHeading } from '../../components/common';

const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Nhập họ tên ít nhất 2 ký tự')
      .max(150, 'Họ tên tối đa 150 ký tự'),
    email: z.email('Email không hợp lệ').max(255, 'Email quá dài'),
    phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số'),
    password: z
      .string()
      .min(8, 'Mật khẩu tối thiểu 8 ký tự')
      .refine((value) => new TextEncoder().encode(value).length <= 72, 'Mật khẩu tối đa 72 byte')
      .regex(/^(?=.*[A-Za-z])(?=.*[0-9]).+$/, 'Mật khẩu cần có chữ và số'),
    confirm: z.string(),
    newsletter: z.boolean().optional(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    message: 'Mật khẩu xác nhận không khớp',
  });

export function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const loginMessage: unknown = location.state?.message;
  const [visible, setVisible] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  if (user && (!useDbAuth || hasAccessToken()))
    return <Navigate to="/account/profile" replace />;

  return (
    <div className="container-shell py-12 md:py-16 max-w-5xl">
      <PageHeading
        eyebrow="TÀI KHOẢN THÀNH VIÊN"
        title="ĐĂNG NHẬP HOẶC TẠO TÀI KHOẢN"
        description="Chào mừng bạn đến với FashionHub. Vui lòng đăng nhập để tiếp tục trải nghiệm mua sắm."
      />

      {typeof loginMessage === 'string' && (
        <p role="status" className="mb-4 rounded bg-emerald-50 p-3 text-sm text-emerald-800">{loginMessage}</p>
      )}
      <div className="grid md:grid-cols-2 gap-10 lg:gap-14 pt-2">
        {/* Left Column: Login Form */}
        <div className="panel space-y-6">
          <div className="pb-3 border-b border-[#eee]">
            <h2 className="text-base font-extrabold uppercase tracking-wider text-ink">
              ĐÃ CÓ TÀI KHOẢN
            </h2>
            <p className="text-xs text-[#767676] mt-1">
              Đăng nhập bằng địa chỉ email và mật khẩu của bạn.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(async (values) => {
              setServerError('');
              if (useDbAuth && values.email.trim().toLowerCase() === 'admin@fashionhub.vn'
                  && values.password === 'Demo@123') {
                setServerError('Tài khoản dùng thử không dùng được tại đây. Vui lòng đăng nhập bằng tài khoản quản trị của bạn.');
                return;
              }
              try {
                await login(values.email, values.password);
                navigate((location.state as { from?: string } | null)?.from ?? '/');
              } catch (error) {
                setServerError(error instanceof Error ? error.message : 'Đăng nhập thất bại.');
              }
            })}
            className="space-y-4"
          >
            <label className="form-label">
              Địa chỉ Email
              <input
                className="field mt-1.5"
                type="email"
                autoComplete="email"
                placeholder="example@domain.com"
                {...register('email')}
              />
              {errors.email && <span className="field-error">{errors.email.message}</span>}
            </label>

            <label className="form-label">
              Mật khẩu
              <div className="relative mt-1.5">
                <input
                  className="field pr-12"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setVisible(!visible)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-ink"
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password.message}</span>}
            </label>

            <div className="flex justify-end text-xs">
              <Link to="/forgot-password" state={{ email: getValues('email') }}
                onClick={event => {
                  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  navigate('/forgot-password', { state: { email: getValues('email') } });
                }}
                className="text-[#666] hover:text-brand underline">
                Quên mật khẩu?
              </Link>
            </div>

            {serverError && <p className="field-error font-medium">{serverError}</p>}

            <button disabled={isSubmitting} className="btn-primary w-full py-4 text-sm mt-2">
              {isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
            </button>
          </form>

          {!useDbAuth && (
            <div className="bg-[#f8f8f8] border border-[#e5e5e5] p-4 text-xs mt-6 text-[#555] space-y-1">
              <strong className="block text-ink uppercase tracking-wider mb-1 font-bold">
                Tài khoản dùng thử
              </strong>
              <p>Khách hàng: <span className="font-semibold text-ink">user@fashionhub.vn</span></p>
              <p>Quản trị viên: <span className="font-semibold text-ink">admin@fashionhub.vn</span></p>
              <p>Mật khẩu: <span className="font-semibold text-ink">Demo@123</span></p>
            </div>
          )}
        </div>

        {/* Right Column: New Customer Registration Benefits */}
        <div className="panel bg-[#fafafa] border border-[#e5e5e5] flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#eee] mb-5">
              <h2 className="text-base font-extrabold uppercase tracking-wider text-ink">
                KHÁCH HÀNG MỚI
              </h2>
              <p className="text-xs text-[#767676] mt-1">
                Tạo tài khoản FashionHub hoàn toàn miễn phí.
              </p>
            </div>

            <p className="text-xs text-[#555] leading-relaxed mb-6">
              Đăng ký thành viên để tận hưởng trọn vẹn những ưu đãi độc quyền dành riêng cho bạn:
            </p>

            <ul className="space-y-4 text-xs text-[#444] mb-8">
              <li className="flex items-start gap-3">
                <Gift className="text-brand shrink-0 mt-0.5" size={18} />
                <div>
                  <strong className="block font-bold text-ink">Phiếu giảm giá 100.000₫ chào mừng</strong>
                  <span className="text-[#666]">Áp dụng ngay cho đơn hàng đầu tiên của bạn.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Truck className="text-brand shrink-0 mt-0.5" size={18} />
                <div>
                  <strong className="block font-bold text-ink">Giao hàng miễn phí</strong>
                  <span className="text-[#666]">Miễn phí vận chuyển cho mọi đơn hàng từ 499.000₫.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Sparkles className="text-brand shrink-0 mt-0.5" size={18} />
                <div>
                  <strong className="block font-bold text-ink">Ưu đãi & sự kiện độc quyền</strong>
                  <span className="text-[#666]">Nhận thông báo sớm nhất về các đợt giảm giá giới hạn.</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Check className="text-brand shrink-0 mt-0.5" size={18} />
                <div>
                  <strong className="block font-bold text-ink">Theo dõi & đổi trả dễ dàng</strong>
                  <span className="text-[#666]">Xem lịch sử mua sắm và đổi trả trong 7 ngày tại cửa hàng.</span>
                </div>
              </li>
            </ul>
          </div>

          <Link to="/register" className="btn-secondary w-full py-4 text-center text-sm block">
            TẠO TÀI KHOẢN MỚI
          </Link>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const registerUser = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  return (
    <div className="container-shell py-12 md:py-16 max-w-4xl">
      <PageHeading
        eyebrow="TÀI KHOẢN MỚI"
        title="ĐĂNG KÝ THÀNH VIÊN FASHIONHUB"
        description="Điền thông tin bên dưới để tạo tài khoản và nhận ưu đãi thành viên ngay hôm nay."
      />

      <div className="grid md:grid-cols-12 gap-8 pt-2">
        <div className="md:col-span-8 panel">
          <form
            onSubmit={handleSubmit(async ({ confirm: _confirm, ...values }) => {
              void _confirm;
              setServerError('');
              try {
                await registerUser(values);
                navigate('/account/profile');
              } catch (error) {
                setServerError(error instanceof Error ? error.message : 'Không thể tạo tài khoản.');
              }
            })}
            className="space-y-4"
          >
            {(
              [
                ['fullName', 'Họ và tên', 'text', 'Nguyễn Văn A'],
                ['email', 'Địa chỉ Email', 'email', 'name@example.com'],
                ['phone', 'Số điện thoại', 'tel', '0901234567'],
                ['password', 'Mật khẩu', 'password', 'Tối thiểu 8 ký tự (chữ và số)'],
                ['confirm', 'Xác nhận mật khẩu', 'password', 'Nhập lại mật khẩu'],
              ] as const
            ).map(([name, label, type, placeholder]) => (
              <label className="form-label" key={name}>
                {label}
                <input
                  className="field mt-1.5"
                  type={type}
                  placeholder={placeholder}
                  {...register(name)}
                />
                {errors[name] && <span className="field-error">{errors[name]?.message}</span>}
              </label>
            ))}

            {serverError && <p className="field-error font-medium">{serverError}</p>}

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" {...register('newsletter')} />
              Nhận bản tin sản phẩm mới và ưu đãi từ FashionHub qua email.
            </label>
            <p className="text-[11px] text-[#767676] leading-relaxed pt-2">
              Bằng việc đăng ký, bạn đồng ý với <Link to="/policies/terms" className="underline hover:text-ink">Điều khoản sử dụng</Link> và <Link to="/policies/privacy" className="underline hover:text-ink">Chính sách bảo mật</Link> của FashionHub.
            </p>

            <button disabled={isSubmitting} className="btn-primary w-full py-4 text-sm mt-3">
              {isSubmitting ? 'ĐANG TẠO TÀI KHOẢN...' : 'HOÀN TẤT ĐĂNG KÝ'}
            </button>
          </form>
        </div>

        <div className="md:col-span-4 panel bg-[#fafafa] flex flex-col justify-between h-fit space-y-6">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-ink mb-2">
              ĐÃ CÓ TÀI KHOẢN?
            </h3>
            <p className="text-xs text-[#666] leading-relaxed mb-4">
              Nếu bạn đã đăng ký tài khoản trước đây, vui lòng đăng nhập để tiếp tục.
            </p>
            <Link to="/login" className="btn-outline w-full py-3 text-center text-xs block">
              ĐĂNG NHẬP NGAY
            </Link>
          </div>

          <div className="border-t border-[#eee] pt-4 text-xs text-[#767676] space-y-2">
            <div className="font-bold text-ink">Hỗ trợ khách hàng:</div>
            <p>Hotline: 1900 1234 (8:00 - 21:00 hàng ngày)</p>
            <p>Email: support@fashionhub.vn</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const [email, setEmail] = useState<string>(location.state?.email ?? '');
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'done'>('email');
  const [token, setToken] = useState(new URLSearchParams(location.hash.slice(1)).get('token') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const currentStep = step === 'email' && token ? 'password' : step;

  const sendCode = async () => {
    await httpClient.post('/auth/forgot-password', { email: email.trim() });
    setStep('code');
  };

  return (
    <div className="container-shell py-12 max-w-lg">
      <div className="panel space-y-6">
        <PageHeading title={currentStep === 'password' ? 'Đặt mật khẩu mới' : 'Quên mật khẩu'} />
        {step === 'done' ? <p role="status">Đã đổi mật khẩu. Bạn có thể đăng nhập lại.</p> : (
          <form className="space-y-4" key={currentStep} onSubmit={async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError('');
            try {
              if (currentStep === 'email' || (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'resend') {
                await sendCode();
              } else if (currentStep === 'code') {
                const { data } = await httpClient.post<{ data: { token: string } }>('/auth/verify-reset-code', {
                  email: email.trim(),
                  code: form.get('code'),
                });
                setToken(data.data.token);
                setStep('password');
              } else {
                const password = String(form.get('password'));
                if (password !== form.get('confirm')) throw new Error('Mật khẩu xác nhận không khớp.');
                if (new TextEncoder().encode(password).length > 72) throw new Error('Mật khẩu tối đa 72 byte.');
                await httpClient.post('/auth/reset-password', { token, password });
                if (user?.email.toLowerCase() === email.trim().toLowerCase()) {
                  logout();
                  navigate('/login', { replace: true, state: { message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' } });
                  return;
                }
                setToken('');
                setStep('done');
              }
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Chưa xử lý được yêu cầu.');
            } finally {
              setBusy(false);
            }
          }}>
            {currentStep === 'email' && (
              <label className="form-label">Email đăng ký
                <input className="field mt-1" type="email" autoComplete="email" required maxLength={255}
                  value={email} onChange={event => setEmail(event.target.value)} />
              </label>
            )}
            {currentStep === 'code' && (
              <>
                <p className="text-sm text-slate-600">Nếu <strong>{email}</strong> đã đăng ký, bạn sẽ nhận được mã gồm 6 chữ số. Mã có hiệu lực trong 10 phút.</p>
                <label className="form-label">Mã xác thực
                  <input className="field mt-1 tracking-widest" name="code" inputMode="numeric"
                    autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} />
                </label>
              </>
            )}
            {currentStep === 'password' && (
              <>
                <label className="form-label">Mật khẩu mới (ít nhất 8 ký tự, có chữ và số)
                  <input className="field mt-1" type="password" name="password" autoComplete="new-password"
                    required minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).+" />
                </label>
                <label className="form-label">Nhập lại mật khẩu
                  <input className="field mt-1" type="password" autoComplete="new-password" name="confirm" required />
                </label>
              </>
            )}
            {error && <p role="alert" className="field-error">{error}</p>}
            <button disabled={busy} className="btn-primary w-full">
              {busy ? 'Đang xử lý…' : currentStep === 'email' ? 'Gửi mã xác thực' :
                currentStep === 'code' ? 'Xác nhận mã' : 'Lưu mật khẩu mới'}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              {currentStep !== 'email' && (
                <button type="button" disabled={busy} className="underline" onClick={() => {
                  setError(''); setToken(''); setStep('email');
                }}>{currentStep === 'code' ? 'Đổi địa chỉ email' : 'Yêu cầu mã mới'}</button>
              )}
              {currentStep === 'code' && <button className="text-brand underline" type="submit" value="resend"
                formNoValidate disabled={busy}>Gửi lại mã</button>}
            </div>
          </form>
        )}
        <Link to="/login" className="text-brand">Quay lại đăng nhập</Link>
      </div>
    </div>
  );
}
