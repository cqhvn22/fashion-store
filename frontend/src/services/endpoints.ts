export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    me: '/users/me',
  },
  products: '/products',
  productSlug: (slug: string) => `/products/slug/${slug}`,
  categories: '/categories',
  cart: '/cart',
  orders: '/orders',
  myOrders: '/orders/my',
  chat: '/chat',
  admin: {
    products: '/admin/products',
    orders: '/admin/orders',
    inventory: '/admin/inventory',
    knowledge: '/admin/knowledge',
    statistics: '/admin/statistics',
  },
};
