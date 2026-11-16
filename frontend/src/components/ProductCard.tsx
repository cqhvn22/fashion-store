import { Heart, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types/models';
import { formatCurrency } from '../utils/format';
import { getCardImageUrl, getThumbnailUrl, showOriginalOrPlaceholder } from '../utils/images';
import { useWishlistStore } from '../stores/wishlistStore';

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const liked = useWishlistStore((state) => state.ids.includes(product.id));
  const toggle = useWishlistStore((state) => state.toggle);
  const [heartBurst, setHeartBurst] = useState(0);

  // Extract unique colors with their hex code and optional preview image
  const colorMap = new Map<string, { name: string; hex: string; imageUrl?: string }>();
  for (const v of product.variants) {
    let vImg = v.imageUrl || v.images?.[0]?.url;
    if (!vImg && product.images?.length) {
      const match = product.images.find(img =>
        img.alt?.toLowerCase().includes(v.color.toLowerCase()) ||
        img.url?.toLowerCase().includes(v.color.toLowerCase())
      );
      if (match) vImg = match.url;
    }
    if (!colorMap.has(v.color)) {
      colorMap.set(v.color, {
        name: v.color,
        hex: v.colorCode || '#ddd',
        imageUrl: vImg,
      });
    } else if (vImg && !colorMap.get(v.color)?.imageUrl) {
      colorMap.set(v.color, {
        name: v.color,
        hex: v.colorCode || '#ddd',
        imageUrl: vImg,
      });
    }
  }
  const colorList = Array.from(colorMap.values());
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(colorList[0]?.name ?? '');

  const activeColorName = hoveredColor || selectedColor || colorList[0]?.name;
  const activeColorData = colorList.find((c) => c.name === activeColorName) ?? colorList[0];
  const activeVariant = product.variants
    .filter((variant) => variant.color === activeColorData?.name)
    .sort((a, b) => a.price - b.price)[0];
  const cardPrice = activeVariant?.price ?? product.minPrice;
  const compareAtPrice = activeVariant?.compareAtPrice ?? product.originalPrice;

  const primaryImage = activeVariant?.imageUrl || activeVariant?.images?.[0]?.url || activeColorData?.imageUrl || product.images[0]?.url;
  const secondaryImage = !hoveredColor && (activeVariant?.images?.[1]?.url
    || (activeVariant?.images?.length ? undefined : product.images[1]?.url));

  const discount = compareAtPrice && compareAtPrice > cardPrice
    ? Math.round((1 - cardPrice / compareAtPrice) * 100)
    : 0;

  // Department tag detection (NỮ / NAM / TRẺ EM / UNISEX)
  const isWomen = product.name.toLowerCase().includes('nữ') || product.categoryId?.includes('nu');
  const isMen = product.name.toLowerCase().includes('nam') && !isWomen;
  const genderTag = isWomen ? 'NỮ' : isMen ? 'NAM' : 'UNISEX';

  return (
    <article
      className="product-card group card-stagger"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      {/* Product Image Wrapper with 3:4 ratio */}
      <div className="relative aspect-[3/4] bg-[#f4f4f4] overflow-hidden">
        <Link
          to={`/products/${product.slug}`}
          className="block w-full h-full relative"
          tabIndex={-1}
          aria-hidden="true"
        >
          {/* Primary Image */}
          <img
            key={primaryImage}
            src={getCardImageUrl(primaryImage)}
            alt={product.images[0]?.alt ?? product.name}
            loading="lazy"
            onError={(e) => showOriginalOrPlaceholder(e, primaryImage)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Secondary Cross-fade Image (Model or alternate angle) */}
          {secondaryImage && secondaryImage !== primaryImage && (
            <img
              src={getCardImageUrl(secondaryImage)}
              alt=""
              loading="lazy"
              onError={(e) => showOriginalOrPlaceholder(e, secondaryImage)}
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-400"
            />
          )}
        </Link>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10 pointer-events-none">
          {discount > 0 ? (
            <span className="bg-brand text-white text-[10px] font-extrabold uppercase px-1.5 py-0.5 tracking-wider">
              {product.promotion?.name ?? 'GIẢM GIÁ'}
            </span>
          ) : (
            <span className="bg-ink text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 tracking-wider">
              MỚI
            </span>
          )}
          {discount > 0 && (
            <span className="bg-white text-brand border border-brand text-[10px] font-bold px-1 py-0.5 w-fit">
              -{discount}%
            </span>
          )}
        </div>

        {/* Wishlist Heart Button */}
        <button
          aria-label={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          onClick={() => {
            toggle(product.id);
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              setHeartBurst((value) => value + 1);
            }
          }}
          className={`heart-btn ${liked ? 'text-brand' : 'text-ink'}`}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} strokeWidth={1.8} />
        </button>

        {/* Heart Burst Particle Effect */}
        {heartBurst > 0 && (
          <span
            key={heartBurst}
            className="heart-burst"
            onAnimationEnd={() => setHeartBurst(0)}
            aria-hidden="true"
          >
            <Heart size={50} fill="currentColor" strokeWidth={1.5} />
          </span>
        )}
      </div>

      {/* Product Details */}
      <div className="pt-3 pb-4">
        {/* Color / Variant Swatches with thumbnails */}
        {colorList.length > 0 && (
          <div className="flex items-center gap-2 mb-2.5 overflow-x-auto py-1 scrollbar-none">
            {colorList.slice(0, 6).map((color) => {
              const isHovered = hoveredColor === color.name;
              const isSelected = !hoveredColor && activeColorName === color.name;
              const isActive = isHovered || isSelected;
              return (
                <button
                  key={color.name}
                  type="button"
                  title={`Màu ${color.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedColor(color.name);
                    setHoveredColor(null);
                  }}
                  onMouseEnter={() => setHoveredColor(color.name)}
                  onMouseLeave={() => setHoveredColor(null)}
                  aria-label={`Màu ${color.name}`}
                  className={`group/swatch relative w-6 h-6 sm:w-7 sm:h-7 rounded-full transition-all shrink-0 p-0.5 flex items-center justify-center bg-white ${
                    isActive
                      ? 'ring-1 ring-ink ring-offset-2 ring-offset-white'
                      : 'border border-black/15 hover:border-black/40'
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-[#f4f4f4] flex items-center justify-center">
                    {color.imageUrl ? (
                      <img
                        src={getThumbnailUrl(color.imageUrl)}
                        alt={color.name}
                        className="w-full h-full object-cover object-top transition-transform duration-200 group-hover/swatch:scale-110"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (color.imageUrl && target.getAttribute('src') !== color.imageUrl && target.style.display !== 'none') {
                            target.src = color.imageUrl;
                          } else {
                            target.style.display = 'none';
                          }
                        }}
                      />
                    ) : null}
                    <span
                      className={`w-full h-full rounded-full ${color.imageUrl ? 'hidden' : 'block'}`}
                      style={{ backgroundColor: color.hex }}
                    />
                  </div>
                </button>
              );
            })}
            {colorList.length > 6 && (
              <span className="text-[11px] font-semibold text-[#767676] shrink-0">
                +{colorList.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Gender / Department Tag */}
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#767676] mb-1">
          {genderTag}
        </div>

        {/* Product Title */}
        <Link
          to={`/products/${product.slug}`}
          className="block text-xs sm:text-sm font-bold text-ink line-clamp-2 min-h-9 hover:text-brand transition-colors leading-snug"
        >
          {product.name}
        </Link>

        {/* Price Section */}
        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
          <strong
            className={`text-sm sm:text-base font-black tracking-tight ${
              discount > 0 ? 'text-brand' : 'text-ink'
            }`}
          >
            {formatCurrency(cardPrice)}
          </strong>
          {compareAtPrice && discount > 0 && (
            <span className="text-xs text-[#888] line-through font-normal">
              {formatCurrency(compareAtPrice)}
            </span>
          )}
        </div>

        {/* Rating and Sold */}
        <div className="flex items-center justify-between text-[11px] text-[#767676] mt-2.5 pt-2 border-t border-[#f0f0f0]">
          <span className="flex items-center gap-1 font-medium">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {product.ratingAverage} ({product.reviewCount})
          </span>
          <span>Đã bán {product.soldCount}</span>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}
