import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notificationService } from '../services/notifications';
import { orderService } from '../services/orders';
import { useAuthStore } from '../stores/authStore';
import { demoUsers, seedProducts } from '../mocks/catalog';
import { NotificationBell } from '../components/NotificationBell';

describe('Notification system in frontend', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: demoUsers[0] }); // Nguyễn Minh Anh (user-demo)
  });

  it('lấy danh sách thông báo và số lượng chưa đọc của khách hàng', async () => {
    const list = await notificationService.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((item) => (item as any).recipientUserId === 'user-demo')).toBe(true);

    const count = await notificationService.unreadCount();
    expect(count).toBeGreaterThan(0);
  });

  it('tự động tạo thông báo khi khách hàng đặt đơn hàng mới', async () => {
    const initialList = await notificationService.list();
    const product = seedProducts[0];
    const variant = product.variants[0];

    const order = await orderService.create({
      userId: 'user-demo',
      items: [
        {
          id: variant.id,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productSlug: product.slug,
          imageUrl: product.images[0].url,
          size: variant.size,
          color: variant.color,
          unitPrice: variant.price,
          quantity: 1,
          availableStock: variant.stockQuantity,
          selected: true,
        },
      ],
      address: {
        recipientName: 'Nguyễn Minh Anh',
        phone: '0901234567',
        province: 'Hà Nội',
        district: 'Ba Đình',
        ward: 'Ngọc Hà',
        detail: '12 Hoàng Hoa Thám',
      },
    });

    // Thông báo cho khách hàng
    const updatedList = await notificationService.list();
    expect(updatedList.length).toBe(initialList.length + 1);
    expect(updatedList[0].body).toContain(order.orderCode);

    // Chuyển sang tài khoản Admin kiểm tra thông báo đơn hàng mới
    useAuthStore.setState({ user: demoUsers[1] }); // admin-demo
    const adminList = await notificationService.list();
    expect(adminList.some((item) => item.body.includes(order.orderCode))).toBe(true);
  });

  it('tự động tạo thông báo khi Admin cập nhật trạng thái đơn hàng', async () => {
    const product = seedProducts[0];
    const variant = product.variants[0];

    const order = await orderService.create({
      userId: 'user-demo',
      items: [
        {
          id: variant.id,
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productSlug: product.slug,
          imageUrl: product.images[0].url,
          size: variant.size,
          color: variant.color,
          unitPrice: variant.price,
          quantity: 1,
          availableStock: variant.stockQuantity,
          selected: true,
        },
      ],
      address: {
        recipientName: 'Nguyễn Minh Anh',
        phone: '0901234567',
        province: 'Hà Nội',
        district: 'Ba Đình',
        ward: 'Ngọc Hà',
        detail: '12 Hoàng Hoa Thám',
      },
    });

    // Admin cập nhật sang CONFIRMED
    await orderService.updateStatus(order.id, 'CONFIRMED');

    // Khách hàng kiểm tra thông báo
    useAuthStore.setState({ user: demoUsers[0] });
    const userNotifs = await notificationService.list();
    expect(userNotifs.some((n) => n.body.toLowerCase().includes('đã xác nhận'))).toBe(true);
  });

  it('đánh dấu thông báo đã đọc', async () => {
    const list = await notificationService.list();
    const unread = list.find((n) => !n.readAt);
    expect(unread).toBeDefined();

    await notificationService.markRead(unread!.id);
    const after = await notificationService.list();
    const target = after.find((n) => n.id === unread!.id);
    expect(target?.readAt).toBeTruthy();
  });

  it('hiển thị chuông thông báo và danh sách thông báo khi click', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Nút chuông thông báo xuất hiện
    const bellBtn = await screen.findByRole('button', { name: /Thông báo/i });
    expect(bellBtn).toBeInTheDocument();

    // Bấm mở popup thông báo
    fireEvent.click(bellBtn);
    expect(screen.getByText('Thông báo')).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('gom các thông báo cùng một đơn vào làm 1 và chỉ giữ trạng thái mới nhất', async () => {
    const orderId = 'order-consolidate-test-123';
    const orderCode = 'FH-999888777';

    // Thêm 3 thông báo liên tiếp cho cùng 1 đơn hàng theo thời gian
    notificationService.markAllRead && (await notificationService.markAllRead());

    const t1 = new Date(Date.now() - 300000).toISOString();
    const t2 = new Date(Date.now() - 200000).toISOString();
    const t3 = new Date(Date.now() - 100000).toISOString();

    const notifs = [
      {
        id: 'notif-t1',
        recipientUserId: 'user-demo',
        orderId,
        subject: 'Đơn hàng mới',
        body: `Đơn ${orderCode} đã được đặt thành công.`,
        readAt: null,
        createdAt: t1,
      },
      {
        id: 'notif-t2',
        recipientUserId: 'user-demo',
        orderId,
        subject: 'Cập nhật trạng thái đơn hàng',
        body: `Đơn hàng ${orderCode} của bạn đã chuyển sang trạng thái "Đã xác nhận".`,
        readAt: null,
        createdAt: t2,
      },
      {
        id: 'notif-t3',
        recipientUserId: 'user-demo',
        orderId,
        subject: 'Cập nhật trạng thái đơn hàng',
        body: `Đơn hàng ${orderCode} của bạn đã chuyển sang trạng thái "Đang chuẩn bị".`,
        readAt: null,
        createdAt: t3,
      },
    ];

    // Ghi vào mock storage
    const current = (await import('../services/notifications')).getStoredMockNotifications();
    (await import('../services/notifications')).saveStoredMockNotifications([...notifs, ...current]);

    const groupedList = await notificationService.list();
    const orderItems = groupedList.filter(
      (item) => item.orderId === orderId || item.body.includes(orderCode)
    );

    // Chỉ còn đúng 1 thông báo cho đơn này
    expect(orderItems.length).toBe(1);
    // Và thông báo đó mang trạng thái mới nhất ("Đang chuẩn bị")
    expect(orderItems[0].body).toContain('Đang chuẩn bị');
    expect(orderItems[0].id).toBe('notif-t3');
  });

  it('hiển thị số thông báo chưa đọc trên nút chuông thông báo', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Huy hiệu số thông báo chưa đọc hiển thị trên chuông
    const badge = await screen.findByTestId('notification-unread-count');
    expect(badge).toBeInTheDocument();
    expect(Number(badge.textContent)).toBeGreaterThan(0);

    // Bấm mở danh sách và click "Đánh dấu đã đọc"
    const bellBtn = screen.getByRole('button', { name: /Thông báo/i });
    fireEvent.click(bellBtn);

    const markAllBtn = await screen.findByRole('button', { name: /Đánh dấu đã đọc/i });
    fireEvent.click(markAllBtn);

    // Sau khi đánh dấu đã đọc, unread count trở về 0
    const unreadCount = await notificationService.unreadCount();
    expect(unreadCount).toBe(0);
  });
});
