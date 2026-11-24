import type { SyntheticEvent } from 'react';

export function showProductPlaceholder(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.getAttribute('src') !== '/images/product-placeholder.svg') {
    image.src = '/images/product-placeholder.svg';
  }
}

/** Try the original image once, then stop at the placeholder. */
export function showOriginalOrPlaceholder(
  event: SyntheticEvent<HTMLImageElement>, originalUrl?: string | null,
) {
  const image = event.currentTarget;
  const current = image.getAttribute('src');
  if (current === '/images/product-placeholder.svg') return;
  if (originalUrl && current !== originalUrl) {
    image.src = originalUrl;
    return;
  }
  image.src = '/images/product-placeholder.svg';
}

/**
 * Returns an optimized lightweight thumbnail URL (~1.6KB) for small avatars,
 * color swatches, and thumbnail strips to significantly reduce system and network load.
 */
export function getThumbnailUrl(url?: string | null): string {
  if (!url) return '/images/product-placeholder.svg';

  // Local product images: /images/products/xyz.(png|jpg) -> /images/products/thumbs/xyz.jpg
  if (url.startsWith('/images/products/')) {
    if (url.startsWith('/images/products/thumbs/')) {
      return url;
    }
    return url
      .replace('/images/products/', '/images/products/thumbs/')
      .replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg');
  }

  // Unsplash images: append width & quality parameters
  if (url.includes('images.unsplash.com')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=120&q=75&auto=format`;
  }

  return url;
}

/**
 * Returns an optimized card/medium-sized image URL (~21KB, 600x600)
 * for product cards, catalog listings, cart items, and medium preview areas,
 * reducing payload and memory consumption by over 95%.
 */
export function getCardImageUrl(url?: string | null): string {
  if (!url) return '/images/product-placeholder.svg';

  // Local product images: /images/products/xyz.(png|jpg) -> /images/products/cards/xyz.jpg
  if (url.startsWith('/images/products/')) {
    if (url.startsWith('/images/products/cards/')) {
      return url;
    }
    if (url.startsWith('/images/products/thumbs/')) {
      return url.replace('/images/products/thumbs/', '/images/products/cards/');
    }
    return url
      .replace('/images/products/', '/images/products/cards/')
      .replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg');
  }

  // Unsplash images: append width & quality parameters for card view
  if (url.includes('images.unsplash.com')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=600&q=80&auto=format`;
  }

  return url;
}
