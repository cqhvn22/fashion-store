import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { getThumbnailUrl } from '../utils/images';

export interface LightboxImage {
  id?: string;
  url: string;
  alt?: string;
}

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: LightboxImage[];
  initialIndex?: number;
  productName?: string;
  onIndexChange?: (newIndex: number) => void;
}

export function ImageLightboxModal({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
  productName = '',
  onIndexChange,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  // Sync initialIndex when modal opens or initialIndex changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, images.length]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(4, Math.round((prev + 0.5) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(1, Math.round((prev - 0.5) * 10) / 10);
      if (next === 1) {
        setOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    handleResetZoom();
    setCurrentIndex((prev) => {
      const next = (prev - 1 + images.length) % images.length;
      onIndexChange?.(next);
      return next;
    });
  }, [images.length, handleResetZoom, onIndexChange]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    handleResetZoom();
    setCurrentIndex((prev) => {
      const next = (prev + 1) % images.length;
      onIndexChange?.(next);
      return next;
    });
  }, [images.length, handleResetZoom, onIndexChange]);

  const handleSelectThumbnail = (index: number) => {
    if (index === currentIndex) return;
    handleResetZoom();
    setCurrentIndex(index);
    onIndexChange?.(index);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetZoom();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Drag / pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = { x: touch.clientX, y: touch.clientY };
    offsetStartRef.current = { ...offset };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Toggle zoom on double click
  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2.5);
    } else {
      handleResetZoom();
    }
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh sản phẩm"
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-fade-in text-white"
      onClick={(e) => {
        // Close modal if clicking directly on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Top Bar: Title, Zoom Controls & Close Button */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Left: Product title and photo counter */}
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <span className="bg-white/10 text-white text-xs font-mono font-bold px-2.5 py-1 rounded-full border border-white/15">
            {currentIndex + 1} / {images.length}
          </span>
          {productName && (
            <h2 className="text-xs sm:text-sm font-semibold truncate text-white/90 max-w-[200px] sm:max-w-md md:max-w-lg">
              {productName}
            </h2>
          )}
        </div>

        {/* Right: Controls (Zoom In, Zoom Out, Reset, Close) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Zoom Controls Pill */}
          <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full border border-white/15 p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              aria-label="Thu nhỏ ảnh"
              title="Thu nhỏ (-)"
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ZoomOut size={16} />
            </button>
            <span
              className="text-[11px] sm:text-xs font-mono font-bold px-1.5 min-w-[42px] text-center"
              title="Mức phóng to hiện tại"
            >
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 4}
              aria-label="Phóng to ảnh"
              title="Phóng to (+)"
              className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <ZoomIn size={16} />
            </button>
            {scale > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Đặt lại kích thước"
                title="Đặt lại 100% (0)"
                className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 text-brand active:scale-95 transition-all border-l border-white/15 ml-0.5"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem trước ảnh"
            title="Đóng (Esc)"
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 transition-all border border-white/15 ml-1 text-white hover:text-brand"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Image Stage */}
      <main
        className="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-6"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Navigation Button: Previous (Back) */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Ảnh trước"
            title="Ảnh trước (Mũi tên trái)"
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-brand text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Center Active Image */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-100 ease-out"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            key={currentImage.url}
            src={currentImage.url}
            alt={currentImage.alt || productName || 'Ảnh sản phẩm'}
            className="max-h-[70vh] sm:max-h-[75vh] w-auto max-w-[90vw] object-contain rounded shadow-2xl select-none pointer-events-auto"
            draggable={false}
          />
        </div>

        {/* Navigation Button: Next */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Ảnh tiếp theo"
            title="Ảnh tiếp theo (Mũi tên phải)"
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 p-3 sm:p-4 rounded-full bg-black/60 hover:bg-brand text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all hover:scale-110 active:scale-95"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </main>

      {/* Bottom Filmstrip / Thumbnails Bar */}
      <footer className="relative z-20 pb-4 pt-2 px-4 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-[92vw] sm:max-w-2xl px-3 py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/15 scrollbar-thin">
            {images.map((img, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={img.id || `${img.url}-${idx}`}
                  type="button"
                  onClick={() => handleSelectThumbnail(idx)}
                  aria-label={`Xem ảnh preview ${idx + 1}`}
                  className={`w-12 h-14 sm:w-14 sm:h-16 rounded-lg overflow-hidden shrink-0 transition-all ${
                    isActive
                      ? 'border-2 border-brand ring-2 ring-white scale-105 opacity-100'
                      : 'border border-white/20 opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <img
                    src={getThumbnailUrl(img.url)}
                    alt=""
                    aria-hidden="true"
                    className="w-full h-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        )}
        <div className="text-[11px] text-white/60 hidden sm:block">
          Dùng phím mũi tên ← → để chuyển ảnh · Cuộn chuột hoặc nút +/- để phóng to · Nhấp đúp để phóng to/thu nhỏ
        </div>
      </footer>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
