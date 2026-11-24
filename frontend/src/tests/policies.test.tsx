import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContentPage } from '../features/content/ContentPages';

describe('Trang chính sách dịch vụ', () => {
  it('hiển thị bảng hướng dẫn chọn size chuẩn nam với đầy đủ các size M, L, XL, 2XL, 3XL', () => {
    render(
      <MemoryRouter initialEntries={['/size-guide']}>
        <Routes>
          <Route path="/size-guide" element={<ContentPage name="size-guide" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /Bảng Kích Cỡ Chuẩn Nam \(M – 3XL\)/i })
    ).toBeInTheDocument();

    // Bảng size áo nam có các kích cỡ M, L, XL, 2XL, 3XL
    expect(screen.getAllByText('M').length).toBeGreaterThan(0);
    expect(screen.getAllByText('L').length).toBeGreaterThan(0);
    expect(screen.getAllByText('XL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2XL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3XL').length).toBeGreaterThan(0);

    // Bảng quy đổi quần nam có size số tương ứng
    expect(screen.getByText('28 – 29')).toBeInTheDocument();
    expect(screen.getByText('30 – 31')).toBeInTheDocument();
    expect(screen.getByText('32 – 33')).toBeInTheDocument();
    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Hệ thống cửa hàng/i })).not.toBeInTheDocument();
  });

  it('hiển thị trang Điều khoản dịch vụ với giao diện tối giản, tinh tế, không màu mè', () => {
    render(
      <MemoryRouter initialEntries={['/policies/terms']}>
        <Routes>
          <Route path="/policies/terms" element={<ContentPage name="terms" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /Điều Khoản Dịch Vụ & Sử Dụng Website/i })
    ).toBeInTheDocument();

    // Các mục quy định
    expect(screen.getByText(/1\. Quy định về tài khoản người dùng/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Giá cả, thông tin sản phẩm và chương trình khuyến mãi/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Xác lập đơn hàng và hợp đồng mua bán/i)).toBeInTheDocument();
    expect(screen.getByText(/Lưu ý quan trọng:/i)).toBeInTheDocument();
  });
});
