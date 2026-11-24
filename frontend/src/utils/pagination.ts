/**
 * Generates a clean, compact array of page numbers with ellipsis ('...').
 *
 * Examples (totalPages = 27):
 * - Page 1:  [1, 2, 3, '...', 27]
 * - Page 2:  [1, 2, 3, '...', 27]
 * - Page 3:  [1, 2, 3, 4, '...', 27]
 * - Page 4:  [1, 2, 3, 4, 5, '...', 27]
 * - Page 14: [1, '...', 13, 14, 15, '...', 27]
 * - Page 25: [1, '...', 24, 25, 26, 27]
 * - Page 27: [1, '...', 25, 26, 27]
 */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: Math.max(0, totalPages) }, (_, i) => i + 1);
  }

  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const showLeftDots = safePage > 4;
  const showRightDots = safePage < totalPages - 3;

  if (!showLeftDots && showRightDots) {
    const end = Math.max(3, Math.min(safePage + 1, 5));
    const items: (number | '...')[] = [];
    for (let i = 1; i <= end; i++) items.push(i);
    items.push('...');
    items.push(totalPages);
    return items;
  }

  if (showLeftDots && !showRightDots) {
    const start = Math.min(totalPages - 2, Math.max(safePage - 1, totalPages - 4));
    const items: (number | '...')[] = [1, '...'];
    for (let i = start; i <= totalPages; i++) items.push(i);
    return items;
  }

  return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
}
