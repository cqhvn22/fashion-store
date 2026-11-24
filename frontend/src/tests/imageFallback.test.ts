import { describe, expect, it } from 'vitest';
import type { SyntheticEvent } from 'react';
import { showOriginalOrPlaceholder } from '../utils/images';

describe('Ảnh menu lỗi', () => {
  it('chỉ thử ảnh gốc một lần rồi dừng tại ảnh thay thế', () => {
    const image = document.createElement('img');
    image.setAttribute('src', '/images/products/thumbs/missing.jpg');
    const event = { currentTarget: image } as SyntheticEvent<HTMLImageElement>;

    showOriginalOrPlaceholder(event, '/images/products/missing.jpg');
    expect(image.getAttribute('src')).toBe('/images/products/missing.jpg');

    showOriginalOrPlaceholder(event, '/images/products/missing.jpg');
    expect(image.getAttribute('src')).toBe('/images/product-placeholder.svg');

    showOriginalOrPlaceholder(event, '/images/products/missing.jpg');
    expect(image.getAttribute('src')).toBe('/images/product-placeholder.svg');
  });
});
