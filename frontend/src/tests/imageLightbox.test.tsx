import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductDetailPage } from '../features/catalog/CatalogPages';
import { ImageLightboxModal } from '../components/ImageLightboxModal';
import { seedProducts } from '../mocks/catalog';
import { productService } from '../services/catalog';

describe('Chức năng phóng to & xem trước ảnh sản phẩm (Image Lightbox)', () => {
  const sampleImages = [
    { id: 'img-1', url: '/test-img-1.jpg', alt: 'Ảnh 1' },
    { id: 'img-2', url: '/test-img-2.jpg', alt: 'Ảnh 2' },
    { id: 'img-3', url: '/test-img-3.jpg', alt: 'Ảnh 3' },
  ];

  it('ImageLightboxModal: phóng to, thu nhỏ, đặt lại kích thước và chuyển ảnh next/back', () => {
    const handleClose = vi.fn();
    const handleIndexChange = vi.fn();

    render(
      <ImageLightboxModal
        isOpen={true}
        onClose={handleClose}
        images={sampleImages}
        initialIndex={0}
        productName="Áo Khoác Nam Test"
        onIndexChange={handleIndexChange}
      />
    );

    // Kiểm tra modal hiển thị
    const dialog = screen.getByRole('dialog', { name: 'Xem ảnh sản phẩm' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Áo Khoác Nam Test')).toBeInTheDocument();

    // Mức zoom ban đầu là 100%
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Bấm nút phóng to (+)
    const zoomInBtn = screen.getByRole('button', { name: 'Phóng to ảnh' });
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('150%')).toBeInTheDocument();

    // Nút đặt lại kích thước xuất hiện khi zoom > 100%
    const resetZoomBtn = screen.getByRole('button', { name: 'Đặt lại kích thước' });
    expect(resetZoomBtn).toBeInTheDocument();
    fireEvent.click(resetZoomBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();

    // Bấm nút chuyển ảnh tiếp theo (Next)
    const nextBtn = screen.getByRole('button', { name: 'Ảnh tiếp theo' });
    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(handleIndexChange).toHaveBeenCalledWith(1);

    // Bấm nút chuyển ảnh trước (Back)
    const prevBtn = screen.getByRole('button', { name: 'Ảnh trước' });
    fireEvent.click(prevBtn);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Bấm thumbnail ở filmstrip bên dưới
    const thumb3 = screen.getByRole('button', { name: 'Xem ảnh preview 3' });
    fireEvent.click(thumb3);
    expect(screen.getByText('3 / 3')).toBeInTheDocument();

    // Bấm nút đóng modal
    const closeBtn = screen.getByRole('button', { name: 'Đóng xem trước ảnh' });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('ProductDetailPage: mở preview lightbox khi người dùng bấm vào ảnh lớn hoặc nút Phóng to', async () => {
    const product = seedProducts[0];
    vi.spyOn(productService, 'bySlug').mockResolvedValue(product);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={[`/products/${product.slug}`]}>
        <QueryClientProvider client={client}>
          <Routes><Route path="/products/:slug" element={<ProductDetailPage />} /></Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: product.name, level: 1 });

    // Ban đầu lightbox chưa mở
    expect(screen.queryByRole('dialog', { name: 'Xem ảnh sản phẩm' })).not.toBeInTheDocument();

    // Bấm nút Phóng to trên ảnh lớn
    const zoomOverlayBtn = screen.getByRole('button', { name: 'Phóng to ảnh xem trước' });
    expect(zoomOverlayBtn).toBeInTheDocument();
    fireEvent.click(zoomOverlayBtn);

    // Lightbox modal xuất hiện
    expect(screen.getByRole('dialog', { name: 'Xem ảnh sản phẩm' })).toBeInTheDocument();

    // Đóng bằng phím Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Xem ảnh sản phẩm' })).not.toBeInTheDocument();
  });
});
