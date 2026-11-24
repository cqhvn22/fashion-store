import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HomeHeroBanner } from '../features/catalog/CatalogPages';
import type { HomeBanner } from '../types/models';

afterEach(cleanup);

const mockBanners: HomeBanner[] = [
  {
    id: 'banner-1',
    title: 'Bộ sưu tập mùa hè',
    subtitle: 'Mát mẻ và năng động',
    imageUrl: 'https://images.unsplash.com/photo-1?w=800',
    linkUrl: '/products?category=summer',
    buttonLabel: 'Khám phá ngay',
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'banner-2',
    title: 'Thời trang công sở',
    subtitle: 'Thanh lịch mỗi ngày',
    imageUrl: 'https://images.unsplash.com/photo-2?w=800',
    linkUrl: '/products?category=work',
    buttonLabel: 'Xem thêm',
    sortOrder: 1,
    isActive: true,
  },
];

describe('HomeHeroBanner Component', () => {
  it('hiển thị đầy đủ thông tin banner và bộ điều khiển slide', () => {
    render(
      <MemoryRouter>
        <HomeHeroBanner banners={mockBanners} />
      </MemoryRouter>,
    );

    // Initial counter: 01 / 02
    expect(screen.getByText('01 / 02')).toBeInTheDocument();
    // Buttons exist
    expect(screen.getAllByLabelText('Banner trước').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText('Banner tiếp theo').length).toBeGreaterThanOrEqual(1);
  });

  it('chuyển slide khi click nút tiếp theo hoặc nút trước', () => {
    render(
      <MemoryRouter>
        <HomeHeroBanner banners={mockBanners} />
      </MemoryRouter>,
    );

    const nextButtons = screen.getAllByLabelText('Banner tiếp theo');
    fireEvent.click(nextButtons[0]);

    // Should update counter to 02 / 02
    expect(screen.getByText('02 / 02')).toBeInTheDocument();

    const prevButtons = screen.getAllByLabelText('Banner trước');
    fireEvent.click(prevButtons[0]);

    // Should return to 01 / 02
    expect(screen.getByText('01 / 02')).toBeInTheDocument();
  });

  it('hỗ trợ cuộn chuột ngang (horizontal wheel) để đổi banner', () => {
    const { container } = render(
      <MemoryRouter>
        <HomeHeroBanner banners={mockBanners} />
      </MemoryRouter>,
    );

    const carousel = container.querySelector('section[aria-label="Banner trang chủ"]');
    expect(carousel).not.toBeNull();

    // Wheel scroll right
    fireEvent.wheel(carousel!, { deltaX: 50, deltaY: 0 });
    expect(screen.getByText('02 / 02')).toBeInTheDocument();
  });

  it('hỗ trợ kéo chuột/vuốt ngón tay (pointer drag) qua lại để chuyển banner', () => {
    const { container } = render(
      <MemoryRouter>
        <HomeHeroBanner banners={mockBanners} />
      </MemoryRouter>,
    );

    const carousel = container.querySelector('section[aria-label="Banner trang chủ"]');
    expect(carousel).not.toBeNull();

    // Drag left (> 60px) to go next
    fireEvent.pointerDown(carousel!, { clientX: 200, clientY: 100, button: 0 });
    fireEvent.pointerMove(carousel!, { clientX: 120, clientY: 100 });
    fireEvent.pointerUp(carousel!);

    expect(screen.getByText('02 / 02')).toBeInTheDocument();
  });
});
