import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CheckoutPage } from '../features/checkout/CheckoutPages';
import { addressService } from '../services/addresses';
import { useAuthStore } from '../stores/authStore';
import { useCartStore } from '../stores/cartStore';
import type { Address } from '../types/models';

afterEach(cleanup);

const mockUser = {
  id: 'test-user-1',
  fullName: 'Trần Văn A',
  email: 'user@fashionhub.vn',
  phone: '0901234567',
  role: 'USER' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('fashionhub_auth', JSON.stringify({ state: { user: mockUser }, version: 0 }));
  useCartStore.setState({
    items: [
      {
        id: 'cart-item-1',
        productId: 'prod-01',
        productSlug: 'ao-thun-co-tron',
        variantId: 'var-01',
        productName: 'Áo thun cổ tròn',
        color: 'Trắng',
        size: 'L',
        unitPrice: 199000,
        quantity: 1,
        selected: true,
        imageUrl: 'https://example.com/img.jpg',
      },
    ],
  });
  useAuthStore.setState({
    user: mockUser,
  });
});

describe('Chức năng địa chỉ đã lưu trong thanh toán', () => {
  it('hiển thị danh sách địa chỉ đã lưu và tự động điền địa chỉ mặc định', async () => {
    const mockAddress: Address = {
      id: 'addr-01',
      recipientName: 'Trần Văn A',
      phone: '0901234567',
      province: 'Thành phố Hà Nội',
      ward: 'Phường Hoàn Kiếm',
      detail: '123 Phố Cổ',
      isDefault: true,
    };
    await addressService.save('test-user-1', mockAddress);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <CheckoutPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Block địa chỉ đã lưu phải hiển thị
    await waitFor(() => {
      expect(screen.getByText(/ĐỊA CHỈ NHẬN HÀNG ĐÃ LƯU/)).toBeInTheDocument();
    });

    // Form phải được điền tự động từ địa chỉ mặc định
    await waitFor(() => {
      const recipientInput = screen.getByLabelText(/Họ tên người nhận/i) as HTMLInputElement;
      expect(recipientInput.value).toBe('Trần Văn A');
    });

    await waitFor(() => {
      const detailInput = screen.getByLabelText(/Địa chỉ chi tiết/i) as HTMLInputElement;
      expect(detailInput.value).toBe('123 Phố Cổ');
    });

    // Nút lưu địa chỉ phải hiện diện
    expect(screen.getByText('Lưu địa chỉ hiện tại vào sổ địa chỉ')).toBeInTheDocument();

    // Checkbox ghi nhớ địa chỉ phải hiện diện
    expect(
      screen.getByLabelText(/Ghi nhớ và lưu địa chỉ này vào sổ địa chỉ/i),
    ).toBeInTheDocument();
  });

  it('cho phép lưu địa chỉ hiện tại vào sổ địa chỉ', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <CheckoutPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Điền form
    fireEvent.change(screen.getByLabelText(/Họ tên người nhận/i), {
      target: { value: 'Lê Thị B' },
    });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/i), {
      target: { value: '0912345678' },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ chi tiết/i), {
      target: { value: '456 Phố Mới' },
    });

    // Chọn Tỉnh và Phường hợp lệ
    const provinceSelect = screen.getByLabelText(/Tỉnh \/ Thành phố/i);
    fireEvent.change(provinceSelect, { target: { value: 'Thành phố Hà Nội' } });

    const wardSelect = screen.getByLabelText(/Phường \/ Xã/i);
    fireEvent.change(wardSelect, { target: { value: 'Phường Ba Đình' } });

    // Bấm lưu địa chỉ
    const saveBtn = screen.getByText('Lưu địa chỉ hiện tại vào sổ địa chỉ');
    fireEvent.click(saveBtn);

    // Xác nhận thông báo thành công
    await waitFor(() => {
      expect(screen.getByText(/Đã lưu địa chỉ thành công vào sổ địa chỉ/i)).toBeInTheDocument();
    });

    // Kiểm tra trong service địa chỉ đã được lưu
    const saved = await addressService.list('test-user-1');
    expect(saved.some((item) => item.recipientName === 'Lê Thị B')).toBe(true);
  });
});
