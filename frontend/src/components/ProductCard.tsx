import { Heart, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../types/models';
import { formatCurrency } from '../utils/format';
import { useWishlistStore } from '../stores/wishlistStore';
export function ProductCard({ product }: { product: Product }) {
  const liked = useWishlistStore((state) => state.ids.includes(product.id));
  const toggle = useWishlistStore((state) => state.toggle);
  const [heartBurst, setHeartBurst] = useState(0);
  const discount = product.originalPrice
    ? Math.round((1 - product.minPrice / product.originalPrice) * 100)
    : 0;
  return (
    <article className="product-card group">
      <Link
        to={`/products/${product.slug}`}
        className="block relative overflow-hidden bg-[#ebe7e0] aspect-[4/5]"
      >
        <img
          src={product.images[0]?.url}
          alt={product.images[0]?.alt ?? product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <span className="absolute left-3 top-3 bg-white/95 text-xs font-semibold px-2 py-1 rounded">
          {discount}% OFF
        </span>
      </Link>
      <button
        aria-label={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        onClick={() => {
          toggle(product.id);
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setHeartBurst((value) => value + 1);
          }
        }}
        className={`heart-btn ${liked ? 'text-brand' : ''}`}
      >
        <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
      </button>
      {heartBurst > 0 && (
        <span
          key={heartBurst}
          className="heart-burst"
          onAnimationEnd={() => setHeartBurst(0)}
          aria-hidden="true"
        >
          <Heart size={54} fill="currentColor" strokeWidth={1.4} />
        </span>
      )}
      <div className="p-3.5">
        <Link
          to={`/products/${product.slug}`}
          className="block font-medium line-clamp-2 min-h-12 hover:text-brand"
        >
          {product.name}
        </Link>
        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
          <strong className="text-brand">{formatCurrency(product.minPrice)}</strong>
          <span className="text-xs text-slate-400 line-through">
            {product.originalPrice && formatCurrency(product.originalPrice)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 mt-3">
          <span className="flex items-center gap-1">
            <Star size={13} className="fill-amber-400 text-amber-400" />
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
