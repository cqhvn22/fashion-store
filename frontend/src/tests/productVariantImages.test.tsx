import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductDetailPage } from '../features/catalog/CatalogPages';
import { ProductCard } from '../components/ProductCard';
import { seedProducts } from '../mocks/catalog';
import { productService } from '../services/catalog';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ảnh theo biến thể', () => {
  it('đổi bộ ảnh khi khách chọn màu khác', async () => {
    const product = {
      ...seedProducts[0],
      variants: [
        { id: 'black', sku: 'BLACK-M', color: 'Đen', size: 'M', price: 200000,
          stockQuantity: 5, images: [
            { id: 'black-front', url: '/black-front.jpg', alt: 'Ảnh đen trước', isPrimary: true },
            { id: 'black-back', url: '/black-back.jpg', alt: 'Ảnh đen sau', isPrimary: false },
          ] },
        { id: 'white', sku: 'WHITE-M', color: 'Trắng', size: 'M', price: 210000,
          stockQuantity: 5, images: [
            { id: 'white-front', url: '/white-front.jpg', alt: 'Ảnh trắng', isPrimary: true },
          ] },
      ],
    };
    vi.spyOn(productService, 'bySlug').mockResolvedValue(product);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter initialEntries={[`/products/${product.slug}`]}>
      <QueryClientProvider client={client}>
        <Routes><Route path="/products/:slug" element={<ProductDetailPage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>);

    await screen.findByRole('heading', { name: product.name, level: 1 });
    expect(screen.getByTestId('product-main-image')).toHaveAttribute('src', '/black-front.jpg');
    fireEvent.click(screen.getByRole('button', { name: /^Trắng$/ }));
    expect(screen.getByTestId('product-main-image')).toHaveAttribute('src', '/white-front.jpg');
    expect(screen.queryByRole('button', { name: 'Xem ảnh 2' })).not.toBeInTheDocument();
    client.clear();
  });

  it('hiển thị ảnh thu nhỏ (thumbnail) cho các màu dưới box sản phẩm và đổi ảnh chính khi hover/click', () => {
    const product = {
      ...seedProducts[0],
      variants: [
        {
          id: 'v-tieu',
          sku: 'AT-7761-TIEU',
          color: 'Tiêu',
          colorCode: '#707070',
          size: 'M',
          price: 250000,
          stockQuantity: 10,
          imageUrl: '/img-tieu.jpg',
          images: [{ id: 'img-1', url: '/img-tieu.jpg', alt: 'Tiêu', isPrimary: true }],
          isActive: true,
        },
        {
          id: 'v-den',
          sku: 'AT-7761-DEN',
          color: 'Đen',
          colorCode: '#000000',
          size: 'M',
          price: 250000,
          stockQuantity: 10,
          imageUrl: '/img-den.jpg',
          images: [{ id: 'img-2', url: '/img-den.jpg', alt: 'Đen', isPrimary: true }],
          isActive: true,
        },
      ],
    };

    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>
    );

    const tieuBtn = screen.getByRole('button', { name: 'Màu Tiêu' });
    const denBtn = screen.getByRole('button', { name: 'Màu Đen' });

    expect(tieuBtn).toBeInTheDocument();
    expect(denBtn).toBeInTheDocument();

    const thumbnailImgs = screen.getAllByRole('img');
    const hasTieuImg = thumbnailImgs.some((img) => img.getAttribute('src') === '/img-tieu.jpg');
    const hasDenImg = thumbnailImgs.some((img) => img.getAttribute('src') === '/img-den.jpg');
    expect(hasTieuImg).toBe(true);
    expect(hasDenImg).toBe(true);

    // Hover đổi màu sắc và cập nhật ảnh đại diện
    fireEvent.mouseEnter(denBtn);
    expect(screen.getByRole('button', { name: 'Màu Đen' })).toHaveClass('ring-1');
  });

  it('hiển thị đầy đủ tất cả các ảnh của sản phẩm trong thanh thumbnail bên trái', async () => {
    // seedProducts[0] (Áo Nỉ Basic Vải Xốp Loose L.3.7795) có 3 ảnh trong product.images
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

    // Kiểm tra tất cả các nút xem ảnh ở thanh bên trái
    expect(screen.getByRole('button', { name: 'Xem ảnh 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem ảnh 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem ảnh 3' })).toBeInTheDocument();

    // Bấm xem ảnh 2 -> ảnh chính đổi sang ảnh 2
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));
    expect(screen.getByTestId('product-main-image')).toHaveAttribute('src', product.images[1].url);
  });
});
