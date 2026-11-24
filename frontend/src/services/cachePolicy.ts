// Public metadata changes infrequently. Transactional product data stays short lived.
export const PUBLIC_METADATA_STALE_MS = 2 * 60_000;
export const PUBLIC_METADATA_GC_MS = 15 * 60_000;
export const PRODUCT_STALE_MS = 15_000;
