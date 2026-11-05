import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

export interface CartFlight {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function FlyToCart({ flight, onDone }: { flight: CartFlight; onDone: () => void }) {
  const style = {
    left: flight.x,
    top: flight.y,
    '--fly-x': `${flight.dx}px`,
    '--fly-y': `${flight.dy}px`,
    '--fly-mid-x': `${flight.dx * 0.35}px`,
    '--fly-mid-y': `${flight.dy * 0.35 - 90}px`,
  } as CSSProperties;

  return createPortal(
    <div className="cart-flight" style={style} onAnimationEnd={onDone} aria-hidden="true">
      <img src={flight.imageUrl} alt="" />
    </div>,
    document.body,
  );
}
