import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderTimeline } from '../components/OrderTimeline';
import { OrderInvoiceContent, OrderInvoiceModal, invoiceActions } from '../components/OrderInvoice';
import type { Order } from '../types/models';

describe('OrderTimeline & OrderInvoice', () => {
  const mockOrder: Order = {
    id: 'ord-test-123',
    orderCode: 'FH-2026111199',
    userId: 'user-1',
    items: [
      {
        id: 'line-1',
        productId: 'prod-001',
        variantId: 'prod-001-0-S',
        productName: 'Áo sơ mi linen dáng rộng',
        sku: 'FH-001-0-S',
        imageUrl: 'https://images.unsplash.com/photo-1598554747436?w=200',
        size: 'S',
        color: 'Trắng',
        unitPrice: 329000,
        quantity: 2,
        lineTotal: 658000,
      },
    ],
    shippingAddress: {
      recipientName: 'Trần Thị Thu Trang',
      phone: '0988776655',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      detail: 'Tầng 12, Tòa nhà Vincom Center',
    },
    subtotal: 658000,
    shippingFee: 0,
    discountAmount: 50000,
    totalAmount: 608000,
    paymentMethod: 'COD',
    status: 'PROCESSING',
    note: 'Giao giờ hành chính, gọi trước khi đến',
    createdAt: '2026-11-11T08:00:00.000Z',
    updatedAt: '2026-11-11T08:30:00.000Z',
    history: [
      { status: 'PENDING', at: '2026-11-11T08:00:00.000Z' },
      { status: 'CONFIRMED', at: '2026-11-11T08:15:00.000Z' },
      { status: 'PROCESSING', at: '2026-11-11T08:30:00.000Z' },
    ],
  };

  it('hiển thị lịch sử xử lý dạng timeline với đầy đủ mốc và mốc hiện tại', () => {
    render(<OrderTimeline history={mockOrder.history} />);

    // Kiểm tra tên các trạng thái xuất hiện
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Đang chuẩn bị')).toBeInTheDocument();

    // Mốc mới nhất có huy hiệu "Hiện tại"
    expect(screen.getByText('Hiện tại')).toBeInTheDocument();
  });

  it('hiển thị đầy đủ thông tin trên phiếu đóng gói / hóa đơn bán hàng', () => {
    render(<OrderInvoiceContent order={mockOrder} />);

    // Kiểm tra thông tin đầu hóa đơn & mã đơn
    expect(screen.getByText(/#FH-2026111199/)).toBeInTheDocument();
    expect(screen.getByText('HÓA ĐƠN BÁN HÀNG')).toBeInTheDocument();
    expect(screen.getByText('FASHIONHUB')).toBeInTheDocument();

    // Thông tin người nhận
    expect(screen.getByText('Trần Thị Thu Trang')).toBeInTheDocument();
    expect(screen.getByText('0988776655')).toBeInTheDocument();
    expect(screen.getByText(/Vincom Center/)).toBeInTheDocument();

    // Ghi chú giao hàng
    expect(screen.getByText(/Giao giờ hành chính/)).toBeInTheDocument();

    // Chi tiết sản phẩm
    expect(screen.getByText('Áo sơ mi linen dáng rộng')).toBeInTheDocument();
    expect(screen.getByText(/FH-001-0-S/)).toBeInTheDocument();
    expect(screen.getByText('Trắng / S')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Tiền thu hộ COD
    expect(screen.getByText('TỔNG TIỀN PHẢI THU (COD):')).toBeInTheDocument();
  });

  it('kích hoạt in hóa đơn khi bấm nút In hóa đơn trong modal', () => {
    const printSpy = vi.spyOn(invoiceActions, 'print').mockImplementation(() => {});
    const onClose = vi.fn();

    render(<OrderInvoiceModal order={mockOrder} onClose={onClose} />);

    const printBtn = screen.getByRole('button', { name: /In hóa đơn/ });
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(printSpy).toHaveBeenCalledWith(mockOrder, expect.anything());

    printSpy.mockRestore();
  });
});
