import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, Check, XCircle, ExternalLink, Loader2, Pencil, Send, ImagePlus, Camera, MousePointer } from 'lucide-react';
import ElementPickerOverlay from './ElementPickerOverlay';
import { fetchElementPicker, type ElementBox } from '../../api/tickets';
import VoiceTextarea from '../common/VoiceTextarea';
import { getColumnColor, getColumnLabel } from '../../constants';
import { useLanguage } from '../../hooks/useLanguage';
import { useProject } from '../../hooks/useProject';
import { getTicket, fetchScreenshot } from '../../api/tickets';
import type { Ticket } from '../../types';

interface AttachedImage {
  data: string;
  mediaType: string;
}

const MAX_IMAGES = 4;

async function resizeImage(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUrl.split(',')[1];
      URL.revokeObjectURL(img.src);
      resolve({ data: base64, mediaType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

interface ReviewCompareModalProps {
  ticket: Ticket;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onModify: (id: number, message: string, images?: AttachedImage[]) => void;
}

function IframeSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-subtle animate-pulse z-10">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={40} className="animate-spin text-tx-faint" />
        <div className="space-y-3 w-64">
          <div className="h-3 bg-white/5 rounded-full w-full" />
          <div className="h-3 bg-white/5 rounded-full w-4/5" />
          <div className="h-3 bg-white/5 rounded-full w-3/5" />
          <div className="h-20 bg-white/5 rounded-lg w-full mt-4" />
          <div className="h-3 bg-white/5 rounded-full w-full" />
          <div className="h-3 bg-white/5 rounded-full w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Extract the page path from a staging URL (e.g. https://xxx.pages.dev/about.html → /about.html)
 * and apply it to the production URL so both iframes show the same page.
 */
function getBeforeUrl(productionUrl: string, previewUrl: string | null): string {
  if (!previewUrl) return productionUrl;
  try {
    const parsed = new URL(previewUrl);
    const pathPart = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
    const hashPart = parsed.hash || '';
    if (pathPart || hashPart) {
      return productionUrl.replace(/\/+$/, '') + pathPart + hashPart;
    }
  } catch { /* ignore */ }
  return productionUrl;
}

/** Try to scroll an iframe's content (best-effort, fails silently on cross-origin). */
function scrollIframe(iframe: HTMLIFrameElement | null, position: 'top' | 'bottom') {
  if (!iframe) return;
  try {
    const win = iframe.contentWindow;
    if (!win) return;
    if (position === 'bottom') {
      // Try to access scrollHeight — throws on cross-origin
      const h = win.document.documentElement.scrollHeight || win.document.body.scrollHeight;
      win.scrollTo({ top: h, behavior: 'smooth' });
    } else {
      win.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch {
    // Cross-origin — cannot scroll programmatically
  }
}

export default function ReviewCompareModal({ ticket, onClose, onApprove, onReject, onModify }: ReviewCompareModalProps) {
  const { t } = useLanguage();
  const { currentProject } = useProject();
  const statusColor = getColumnColor(ticket.status);
  const statusLabel = getColumnLabel(ticket.status, t as unknown as Record<string, string>);
  const productionUrl = currentProject?.cf_site_url || null;

  // Iframe refs for scroll control
  const beforeRef = useRef<HTMLIFrameElement>(null);
  const afterRef = useRef<HTMLIFrameElement>(null);

  // Fetch fresh ticket data to ensure staging_url is up-to-date
  const [freshStagingUrl, setFreshStagingUrl] = useState<string | null>(ticket.staging_url || null);
  const [loadingPreview, setLoadingPreview] = useState(!ticket.staging_url);

  // Track iframe load state
  const [beforeLoaded, setBeforeLoaded] = useState(false);
  const [afterLoaded, setAfterLoaded] = useState(false);

  // Modify overlay
  const [showModifyOverlay, setShowModifyOverlay] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<AttachedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;
    setImages(prev => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) return prev;
      const toProcess = fileArray.slice(0, remaining);
      // Process async then update state
      Promise.all(toProcess.map(f => resizeImage(f))).then(resized => {
        setImages(current => {
          const space = MAX_IMAGES - current.length;
          return space > 0 ? [...current, ...resized.slice(0, space)] : current;
        });
      });
      return prev;
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Screenshot crop states
  const [screenshotSrc, setScreenshotSrc] = useState<string | null>(null);
  const [cropSel, setCropSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropOrigin, setCropOrigin] = useState<{ x: number; y: number } | null>(null);
  const [cropDragging, setCropDragging] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const screenshotImgRef = useRef<HTMLImageElement>(null);

  // Element picker states
  const [elementPickerData, setElementPickerData] = useState<{
    screenshotSrc: string;
    elements: ElementBox[];
    pageWidth: number;
    pageHeight: number;
  } | null>(null);
  const [pickingElement, setPickingElement] = useState(false);

  const captureAfterSite = useCallback(async () => {
    if (!freshStagingUrl || images.length >= MAX_IMAGES) return;
    setShowModifyOverlay(false);
    setCapturing(true);
    try {
      const result = await fetchScreenshot(freshStagingUrl);
      setScreenshotSrc(`data:${result.mediaType};base64,${result.data}`);
      setCropSel(null);
    } catch {
      setShowModifyOverlay(true);
    } finally {
      setCapturing(false);
    }
  }, [freshStagingUrl, images.length]);

  /** Map displayed coords to natural image coords (image is full-width, no offsets) */
  const getImageScale = useCallback(() => {
    const img = screenshotImgRef.current;
    if (!img || !img.clientWidth) return null;
    return img.clientWidth / img.naturalWidth;
  }, []);

  const handleCropPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = cropContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + container.scrollTop;
    setCropOrigin({ x, y });
    setCropSel({ x, y, w: 0, h: 0 });
    setCropDragging(true);
    container.setPointerCapture(e.pointerId);
  }, []);

  const handleCropPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDragging || !cropOrigin) return;
    const container = cropContainerRef.current;
    const imgEl = screenshotImgRef.current;
    if (!container || !imgEl) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, imgEl.clientWidth));
    const y = Math.max(0, Math.min(e.clientY - rect.top + container.scrollTop, imgEl.clientHeight));
    setCropSel({
      x: Math.min(cropOrigin.x, x),
      y: Math.min(cropOrigin.y, y),
      w: Math.abs(x - cropOrigin.x),
      h: Math.abs(y - cropOrigin.y),
    });
  }, [cropDragging, cropOrigin]);

  const handleCropPointerUp = useCallback(() => {
    setCropDragging(false);
  }, []);

  const confirmCrop = useCallback(async () => {
    if (!cropSel || !screenshotSrc || cropSel.w < 10 || cropSel.h < 10) return;
    const scale = getImageScale();
    if (!scale) return;

    const img = new Image();
    img.src = screenshotSrc;
    await new Promise(resolve => { img.onload = resolve; });

    const sx = Math.max(0, Math.round(cropSel.x / scale));
    const sy = Math.max(0, Math.round(cropSel.y / scale));
    const sw = Math.min(Math.round(cropSel.w / scale), img.width - sx);
    const sh = Math.min(Math.round(cropSel.h / scale), img.height - sy);
    if (sw < 10 || sh < 10) return;

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

    setImages(prev => prev.length < MAX_IMAGES ? [...prev, { data: base64, mediaType: 'image/jpeg' }] : prev);
    setScreenshotSrc(null);
    setCropSel(null);
    setShowModifyOverlay(true);
  }, [cropSel, screenshotSrc, getImageScale]);

  const cancelCrop = useCallback(() => {
    setScreenshotSrc(null);
    setCropSel(null);
    setShowModifyOverlay(true);
  }, []);

  const launchElementPicker = useCallback(async () => {
    if (!freshStagingUrl) return;
    setShowModifyOverlay(false);
    setPickingElement(true);
    try {
      const result = await fetchElementPicker(freshStagingUrl);
      setElementPickerData({
        screenshotSrc: `data:${result.mediaType};base64,${result.data}`,
        elements: result.elements,
        pageWidth: result.pageWidth,
        pageHeight: result.pageHeight,
      });
    } catch {
      setShowModifyOverlay(true);
    } finally {
      setPickingElement(false);
    }
  }, [freshStagingUrl]);

  const handleElementSelected = useCallback((element: ElementBox, croppedImage: { data: string; mediaType: string }) => {
    const prefix = `[Element: <${element.tag}> | Selecteur: ${element.selector}${element.text ? ` | Texte: "${element.text.substring(0, 60)}"` : ''}]\n`;
    setModifyPrompt(prev => prefix + prev);
    setImages(prev => prev.length < MAX_IMAGES ? [...prev, croppedImage] : prev);
    setElementPickerData(null);
    setShowModifyOverlay(true);
  }, []);

  const cancelElementPicker = useCallback(() => {
    setElementPickerData(null);
    setShowModifyOverlay(true);
  }, []);

  useEffect(() => {
    if (ticket.staging_url) {
      setFreshStagingUrl(ticket.staging_url);
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    getTicket(ticket.id)
      .then(fresh => {
        if (!cancelled && fresh.staging_url) {
          setFreshStagingUrl(fresh.staging_url);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingPreview(false); });
    return () => { cancelled = true; };
  }, [ticket.id, ticket.staging_url]);

  const previewUrl = freshStagingUrl || null;

  // Before URL: production URL + same page path as preview
  const beforeUrl = useMemo(
    () => productionUrl ? getBeforeUrl(productionUrl, previewUrl) : null,
    [productionUrl, previewUrl],
  );

  const handleBeforeLoad = useCallback(() => {
    setBeforeLoaded(true);
    // Auto-scroll to bottom so the user sees footer / bottom changes
    scrollIframe(beforeRef.current, 'bottom');
  }, []);
  const handleAfterLoad = useCallback(() => {
    setAfterLoaded(true);
    scrollIframe(afterRef.current, 'bottom');
  }, []);

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div
        className="relative flex flex-col flex-1 bg-surface overflow-hidden"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header — title + actions in one bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-th-border shrink-0">
          <span className="text-xs font-mono text-tx-faint bg-subtle px-1.5 py-0.5 rounded">#{ticket.id}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide uppercase"
            style={{ backgroundColor: statusColor + '18', color: statusColor, border: `1px solid ${statusColor}30` }}
          >
            {statusLabel}
          </span>
          <h2 className="text-sm font-bold text-tx-primary truncate">{ticket.title}</h2>
          <div className="flex-1" />
          <button onClick={() => setShowModifyOverlay(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/25 border border-amber-500/20 transition-all">
            <Pencil size={12} /> {t.continueModifying}
          </button>
          <button onClick={() => onReject(ticket.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/25 border border-red-500/20 transition-all">
            <XCircle size={12} /> {t.reject}
          </button>
          <button onClick={() => onApprove(ticket.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/25 border border-green-500/20 transition-all">
            <Check size={12} /> {t.approve}
          </button>
          <button onClick={onClose} className="p-1 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors ml-1">
            <X size={16} />
          </button>
        </div>

        {/* Body — 2-column iframes (navigable) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 overflow-hidden">
          {/* Before (Production) */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-1 shrink-0">
              <span className="text-xs font-medium text-tx-faint uppercase tracking-wide">{t.compareBefore}</span>
              {beforeUrl && (
                <a href={beforeUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  — {t.compareOpenFullSite} <ExternalLink size={10} />
                </a>
              )}
            </div>
            {beforeUrl ? (
              <div className="relative flex-1 rounded-xl border border-th-border overflow-hidden bg-white">
                {!beforeLoaded && <IframeSkeleton />}
                <iframe ref={beforeRef} src={beforeUrl} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title={t.compareBefore} onLoad={handleBeforeLoad} />
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-th-border flex items-center justify-center bg-subtle">
                <span className="text-sm text-tx-faint">{t.compareNoProductionUrl}</span>
              </div>
            )}
          </div>
          {/* After (Preview) */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-1 shrink-0">
              <span className="text-xs font-medium text-tx-faint uppercase tracking-wide">{t.compareAfter}</span>
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  — {t.compareOpenFullSite} <ExternalLink size={10} />
                </a>
              )}
            </div>
            {loadingPreview ? (
              <div className="flex-1 rounded-xl border border-th-border flex items-center justify-center bg-subtle">
                <Loader2 size={18} className="animate-spin text-tx-faint mr-2" />
                <span className="text-sm text-tx-faint">{t.compareLoadingPreview}</span>
              </div>
            ) : previewUrl ? (
              <div className="relative flex-1 rounded-xl border border-th-border overflow-hidden bg-white">
                {!afterLoaded && <IframeSkeleton />}
                {/* Wait for Before to load first so the user sees left→right progression */}
                {beforeLoaded && (
                  <iframe ref={afterRef} src={previewUrl} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title={t.compareAfter} onLoad={handleAfterLoad} />
                )}
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-th-border flex items-center justify-center bg-subtle">
                <span className="text-sm text-tx-faint">{t.compareNoPreviewUrl}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modify overlay */}
        {showModifyOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
              className="w-full max-w-lg mx-4 bg-surface border border-th-border-strong rounded-xl shadow-2xl p-6"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-tx-primary">{t.whatChange}</h3>
                <button onClick={() => { setShowModifyOverlay(false); setModifyPrompt(''); setImages([]); }} className="p-1.5 rounded-lg text-tx-faint hover:text-tx-primary hover:bg-subtle-hover transition-colors">
                  <X size={16} />
                </button>
              </div>
              <VoiceTextarea
                value={modifyPrompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setModifyPrompt(e.target.value)}
                placeholder={t.chatPlaceholder}
                rows={5}
                className="w-full bg-subtle border border-th-border-strong rounded-lg px-4 py-3 text-sm text-tx-secondary focus:outline-none focus:border-amber-500/50 resize-none"
                autoFocus
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && modifyPrompt.trim() && !submitting) {
                    setSubmitting(true);
                    onModify(ticket.id, modifyPrompt.trim(), images.length > 0 ? images : undefined);
                  }
                }}
                onPaste={(e) => {
                  const items = e.clipboardData.items;
                  const imageFiles: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                      const file = items[i].getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }
                  if (imageFiles.length > 0) {
                    e.preventDefault();
                    addFiles(imageFiles);
                  }
                }}
              />

              {/* Image picker & thumbnails */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= MAX_IMAGES}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-th-border-strong text-tx-faint hover:text-tx-secondary hover:bg-subtle-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={images.length >= MAX_IMAGES ? t.imageLimitReached : t.addImages}
                >
                  <ImagePlus size={14} />
                  {images.length >= MAX_IMAGES ? t.imageLimitReached : t.addImages}
                </button>
                {freshStagingUrl && (
                  <button
                    type="button"
                    onClick={captureAfterSite}
                    disabled={images.length >= MAX_IMAGES || capturing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-th-border-strong text-tx-faint hover:text-tx-secondary hover:bg-subtle-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={t.captureScreenshot}
                  >
                    <Camera size={14} />
                    {t.captureScreenshot}
                  </button>
                )}
                {/* Element picker — hidden for now */}
                {false && freshStagingUrl && (
                  <button
                    type="button"
                    onClick={launchElementPicker}
                    disabled={pickingElement}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={t.elementPickerBtn}
                  >
                    <MousePointer size={14} />
                    {t.elementPickerBtn}
                  </button>
                )}

                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={`data:${img.mediaType};base64,${img.data}`}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-th-border-strong"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {
                    if (!modifyPrompt.trim() || submitting) return;
                    setSubmitting(true);
                    onModify(ticket.id, modifyPrompt.trim(), images.length > 0 ? images : undefined);
                  }}
                  disabled={!modifyPrompt.trim() || submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 text-sm font-medium rounded-lg hover:bg-amber-500/30 border border-amber-500/20 disabled:opacity-50 transition-all"
                >
                  <Send size={14} /> {submitting ? t.loading : t.confirmChanges}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Loading overlay while capturing screenshot */}
    {capturing && (
      <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-amber-400" />
          <span className="text-sm text-tx-secondary">{t.capturing}</span>
        </div>
      </div>
    )}

    {/* Screenshot crop overlay */}
    {screenshotSrc && (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        {/* Crop header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface/95 border-b border-th-border shrink-0">
          <span className="text-sm text-tx-secondary">{t.selectCropArea}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={confirmCrop}
              disabled={!cropSel || cropSel.w < 10 || cropSel.h < 10}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={14} /> OK
            </button>
            <button
              onClick={cancelCrop}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors"
            >
              <X size={14} /> {t.cancel}
            </button>
          </div>
        </div>
        {/* Crop canvas — full-width image, scrollable like a real page */}
        <div
          ref={cropContainerRef}
          className={`flex-1 relative cursor-crosshair select-none ${cropDragging ? 'overflow-hidden' : 'overflow-y-auto'}`}
          onPointerDown={handleCropPointerDown}
          onPointerMove={handleCropPointerMove}
          onPointerUp={handleCropPointerUp}
          style={{ touchAction: 'none' }}
        >
          <img
            ref={screenshotImgRef}
            src={screenshotSrc}
            alt=""
            className="w-full h-auto pointer-events-none"
            draggable={false}
          />
          {/* Selection rectangle with dark surround */}
          {cropSel && cropSel.w > 0 && cropSel.h > 0 && (
            <div
              className="absolute border-2 border-dashed border-amber-400"
              style={{
                left: cropSel.x,
                top: cropSel.y,
                width: cropSel.w,
                height: cropSel.h,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              }}
            >
              {/* Size indicator */}
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-amber-400 bg-black/70 px-1.5 py-0.5 rounded whitespace-nowrap">
                {Math.round(cropSel.w)} x {Math.round(cropSel.h)}
              </span>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Element picker loading overlay */}
    {pickingElement && (
      <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={40} className="animate-spin text-cyan-400" />
          <span className="text-sm text-tx-secondary">{t.elementPickerLoading}</span>
        </div>
      </div>
    )}

    {/* Element picker overlay */}
    {elementPickerData && (
      <ElementPickerOverlay
        screenshotSrc={elementPickerData.screenshotSrc}
        elements={elementPickerData.elements}
        pageWidth={elementPickerData.pageWidth}
        pageHeight={elementPickerData.pageHeight}
        onSelect={handleElementSelected}
        onCancel={cancelElementPicker}
      />
    )}
    </>
  );
}
