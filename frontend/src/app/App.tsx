import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MainLayout, AdminLayout } from '../components/layout';
import { HomePage, CatalogPage, ProductDetailPage } from '../features/catalog/CatalogPages';
import { LoginPage, RegisterPage, ForgotPasswordPage } from '../features/auth/AuthPages';
import { CartPage, CheckoutPage, SuccessPage } from '../features/checkout/CheckoutPages';
import {
  AddressesPage,
  OrderDetailPage,
  OrdersPage,
  ProfilePage,
  WishlistPage,
} from '../features/account/AccountPages';
import {
  AdminCategories,
  AdminBanners,
  AdminConversations,
  AdminDashboard,
  AdminInventory,
  AdminKnowledge,
  AdminOrderDetail,
  AdminOrders,
  AdminProductForm,
  AdminProducts,
  AdminReports,
  AdminUsers,
} from '../features/admin/AdminPages';
import { AdminPromotions } from '../features/admin/AdminPromotions';
import { AdminLoyalty } from '../features/admin/AdminLoyalty';
import { AdminReviews } from '../features/admin/AdminReviews';
import { AdminHomeCategories } from '../features/admin/AdminHomeCategories';
import { ChatPage } from '../features/chat/ChatWidget';
import { ContentPage, StatusPage } from '../features/content/ContentPages';
import { useAuthStore } from '../stores/authStore';
import { hasAccessToken, useDbAuth } from '../services/httpClient';
import { httpClient } from '../services/httpClient';
import { useQuery } from '@tanstack/react-query';
import type { User } from '../types/models';
import { useEffect, useLayoutEffect } from 'react';
function ProtectedRoute({
  admin = false,
  children,
}: {
  admin?: boolean;
  children: React.ReactNode;
}) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const roleCheck = useQuery({
    queryKey: ['verified-admin-role', user?.id],
    queryFn: async () => (await httpClient.get<{ data: User }>('/users/me')).data.data.role,
    enabled: admin && useDbAuth && user?.role === 'ADMIN',
    staleTime: 0,
    refetchOnMount: 'always',
  });
  if (!user || (useDbAuth && !hasAccessToken()))
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/403" replace />;
  if (admin && useDbAuth) {
    if (roleCheck.isPending || roleCheck.isFetching)
      return <div className="min-h-screen grid place-items-center text-slate-600">Đang kiểm tra quyền truy cập...</div>;
    if (roleCheck.isError || roleCheck.data !== 'ADMIN') return <Navigate to="/403" replace />;
  }
  return children;
}
export function App() {
  const location = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [location.pathname, location.search]);
  const ready = useAuthStore((state) => state.ready);
  const restoreAuth = useAuthStore((state) => state.restoreAuth);
  useEffect(() => {
    void restoreAuth();
    const ended = () => useAuthStore.setState({ user: null, ready: true });
    window.addEventListener('fashionhub-auth-expired', ended);
    return () => window.removeEventListener('fashionhub-auth-expired', ended);
  }, [restoreAuth]);
  if (!ready) return <div className="min-h-screen grid place-items-center text-slate-600">Đang mở cửa hàng...</div>;
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<CatalogPage />} />
        <Route path="/products/:slug" element={<ProductDetailPage />} />
        <Route path="/search" element={<CatalogPage mode="search" />} />
        <Route path="/categories/:slug" element={<CatalogPage mode="category" />} />
        <Route path="/cart" element={<CartPage />} />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/success/:orderId"
          element={
            <ProtectedRoute>
              <SuccessPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/account/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/addresses"
          element={
            <ProtectedRoute>
              <AddressesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/orders/:orderId"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/ai-assistant" element={<ChatPage />} />
        <Route path="/about" element={<ContentPage name="about" />} />
        <Route path="/contact" element={<ContentPage name="contact" />} />
        <Route path="/stores" element={<ContentPage name="stores" />} />
        <Route path="/he-thong-cua-hang" element={<ContentPage name="stores" />} />
        <Route path="/policies/shipping" element={<ContentPage name="shipping" />} />
        <Route path="/policies/returns" element={<ContentPage name="returns" />} />
        <Route path="/policies/privacy" element={<ContentPage name="privacy" />} />
        <Route path="/policies/terms" element={<ContentPage name="terms" />} />
        <Route path="/size-guide" element={<ContentPage name="size-guide" />} />
        <Route path="/403" element={<StatusPage code="403" />} />
        <Route path="/404" element={<StatusPage code="404" />} />
        <Route path="/500" element={<StatusPage code="500" />} />
        <Route path="*" element={<StatusPage code="404" />} />
      </Route>
      <Route
        path="/admin"
        element={
          <ProtectedRoute admin>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="loyalty" element={<AdminLoyalty />} />
        <Route path="products/create" element={<AdminProductForm />} />
        <Route path="products/:id/edit" element={<AdminProductForm />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="home-categories" element={<AdminHomeCategories />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="orders/:orderId" element={<AdminOrderDetail />} />
        <Route path="knowledge" element={<AdminKnowledge />} />
        <Route path="ai-conversations" element={<AdminConversations />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="users" element={<AdminUsers />} />
      </Route>
    </Routes>
  );
}
