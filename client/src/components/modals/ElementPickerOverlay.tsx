import { useState, useCallback, useRef, useEffect } from 'react';
import { MousePointer, Check, X } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import type { ElementBox } from '../../api/tickets';

interface ElementPickerOverlayProps {
  screenshotSrc: string;
  elements: ElementBox[];
  pageWidth: number;
  pageHeight: number;
  onSelect: (element: ElementBox, croppedImage: { data: string; mediaType: string }) => void;
  onCancel: () => void;
}

export default function ElementPickerOverlay({
  screenshotSrc,
  elements,
  pageWidth,
  pageHeight,
  onSelect,
  onCancel,
}: ElementPickerOverlayProps) {
  const { t } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateScale = useCallback(() => {
    const img = imgRef.current;
    if (img && img.naturalWidth > 0) {
      setScale(img.clientWidth / img.naturalWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [updateScale]);

  const handleConfirm = useCallback(async () => {
    if (selectedIdx === null) return;
    const el = elements[selectedIdx];
    const PAD = 10;

    const img = new Image();
    img.src = screenshotSrc;
    await new Promise(resolve => { img.onload = resolve; });

    // Crop at natural resolution
    const natScale = img.naturalWidth / pageWidth;
    const sx = Math.max(0, Math.round(el.rect.x * natScale) - PAD);
    const sy = Math.max(0, Math.round(el.rect.y * natScale) - PAD);
    const sw = Math.min(Math.round(el.rect.width * natScale) + PAD * 2, img.naturalWidth - sx);
    const sh = Math.min(Math.round(el.rect.height * natScale) + PAD * 2, img.naturalHeight - sy);

    const MAX = 1200;
    let dw = sw, dh = sh;
    if (dw > MAX || dh > MAX) {
      const r = Math.min(MAX / dw, MAX / dh);
      dw = Math.round(dw * r);
      dh = Math.round(dh * r);
    }

    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    onSelect(el, { data: base64, mediaType: 'image/jpeg' });
  }, [selectedIdx, elements, screenshotSrc, pageWidth, onSelect]);

  const activeIdx = selectedIdx ?? hoveredIdx;
  const activeEl = activeIdx !== null ? elements[activeIdx] : null;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface/95 border-b border-th-border shrink-0">
        <div className="flex items-center gap-3">
          <MousePointer size={16} className="text-cyan-400" />
          <span className="text-sm text-tx-secondary">{t.elementPickerTitle}</span>
          {activeEl && (
            <span className="text-xs bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded-md border border-cyan-500/20 font-mono">
              &lt;{activeEl.tag}&gt;{activeEl.text ? ` "${activeEl.text.substring(0, 30)}${activeEl.text.length > 30 ? '...' : ''}"` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-tx-faint hidden sm:block">{t.elementPickerHint}</span>
          <button
            onClick={handleConfirm}
            disabled={selectedIdx === null}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Check size={14} /> OK
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Screenshot with element overlays */}
      <div ref={containerRef} className="flex-1 relative overflow-y-auto select-none">
        <img
          ref={imgRef}
          src={screenshotSrc}
          alt=""
          className="w-full h-auto pointer-events-none"
          draggable={false}
          onLoad={updateScale}
        />
        {/* Element bounding boxes */}
        {elements.map((el, i) => {
          const isHovered = hoveredIdx === i;
          const isSelected = selectedIdx === i;
          return (
            <div
              key={i}
              className="absolute cursor-pointer transition-colors duration-75"
              style={{
                left: el.rect.x * scale,
                top: el.rect.y * scale,
                width: el.rect.width * scale,
                height: el.rect.height * scale,
                border: isSelected
                  ? '2px solid rgb(6 182 212)'
                  : isHovered
                    ? '2px solid rgb(6 182 212 / 0.7)'
                    : '1px solid transparent',
                backgroundColor: isSelected
                  ? 'rgb(6 182 212 / 0.12)'
                  : isHovered
                    ? 'rgb(6 182 212 / 0.06)'
                    : 'transparent',
                borderRadius: 2,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIdx(prev => prev === i ? null : i);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
