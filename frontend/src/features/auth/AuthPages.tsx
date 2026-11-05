import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { mockMode } from '../../services/httpClient';
import { PageHeading } from '../../components/common';
const loginSchema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Nhập họ tên ít nhất 2 ký tự'),
    email: z.email('Email không hợp lệ'),
    phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số'),
    password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
    confirm: z.string(),
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
  const [visible, setVisible] = useState(false);
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  if (user) return <Navigate to="/account/profile" replace />;
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="text-brand mb-5">
          <LockKeyhole size={28} />
        </div>
        <PageHeading
          eyebrow="CHÀO MỪNG TRỞ LẠI"
          title="Đăng nhập"
          description="Tiếp tục hành trình mua sắm cùng FashionHub."
        />
        <form
          onSubmit={handleSubmit(async (values) => {
            setServerError('');
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
            Email
            <input className="field" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>
          <label className="form-label">
            Mật khẩu
            <div className="relative">
              <input
                className="field pr-12"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                onClick={() => setVisible(!visible)}
                className="absolute right-3 top-3 text-slate-500"
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </label>
          {serverError && <p className="field-error">{serverError}</p>}
          <button disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        {mockMode && (
          <div className="bg-orange-50 p-4 text-sm mt-6 rounded">
            <strong>Tài khoản demo</strong>
            <p>Khách: user@fashionhub.vn</p>
            <p>Admin: admin@fashionhub.vn</p>
            <p>Mật khẩu: Demo@123</p>
          </div>
        )}
        <div className="flex justify-between text-sm mt-6">
          <Link className="text-brand" to="/register">
            Tạo tài khoản
          </Link>
          <Link className="text-slate-500" to="/forgot-password">
            Quên mật khẩu?
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
    <div className="auth-page">
      <div className="auth-card">
        <PageHeading
          eyebrow="THAM GIA FASHIONHUB"
          title="Tạo tài khoản"
          description="Một tài khoản, nhiều trải nghiệm mua sắm."
        />
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
              ['fullName', 'Họ và tên'],
              ['email', 'Email'],
              ['phone', 'Số điện thoại'],
              ['password', 'Mật khẩu'],
              ['confirm', 'Xác nhận mật khẩu'],
            ] as const
          ).map(([name, label]) => (
            <label className="form-label" key={name}>
              {label}
              <input
                className="field"
                type={
                  name === 'password' || name === 'confirm'
                    ? 'password'
                    : name === 'email'
                      ? 'email'
                      : 'text'
                }
                {...register(name)}
              />
              {errors[name] && <span className="field-error">{errors[name]?.message}</span>}
            </label>
          ))}
          {serverError && <p className="field-error">{serverError}</p>}
          <button disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang tạo...' : 'Đăng ký'}
          </button>
        </form>
        <p className="text-sm mt-6">
          Đã có tài khoản?{' '}
          <Link className="text-brand font-semibold" to="/login">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
export function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <PageHeading
          title="Quên mật khẩu"
          description="Nhập email để yêu cầu khôi phục tài khoản."
        />
        {done ? (
          <div className="bg-amber-50 p-4 rounded text-sm">
            Đã ghi nhận yêu cầu trong chế độ demo. Chức năng gửi email sẽ hoạt động khi Backend cung
            cấp API khôi phục mật khẩu.
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setDone(true);
            }}
          >
            <label className="form-label">
              Email
              <input required type="email" className="field" />
            </label>
            <button className="btn-primary w-full mt-5">Tiếp tục</button>
          </form>
        )}
        <Link to="/login" className="block text-brand text-sm mt-6">
          ← Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}
