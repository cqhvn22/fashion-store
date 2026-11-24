import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WishlistPage } from '../features/account/AccountPages';
import { seedProducts } from '../mocks/catalog';
import { productService } from '../services/catalog';
import { useWishlistStore } from '../stores/wishlistStore';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useWishlistStore.setState({ ids: [] });
});

describe('sản phẩm yêu thích', () => {
  it('tải sản phẩm đã lưu theo mã thay vì tìm trong dữ liệu mẫu', async () => {
    const id = '917f5f98-a4da-4c83-9c5e-fbb7e310f086';
    const product = { ...seedProducts[0], id, name: 'Sản phẩm đã yêu thích' };
    const byId = vi.spyOn(productService, 'byId').mockResolvedValue(product);
    useWishlistStore.setState({ ids: [id] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <MemoryRouter>
        <QueryClientProvider client={client}><WishlistPage /></QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: product.name })).toBeInTheDocument();
    expect(byId).toHaveBeenCalledWith(id);
    client.clear();
  });
});
