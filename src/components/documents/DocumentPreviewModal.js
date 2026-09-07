"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Download, FileText, LoaderCircle, X } from "lucide-react";

function isImage(preview = {}) {
  const mime = String(preview.mimeType || "").toLowerCase();
  const name = String(preview.fileName || "").toLowerCase();
  return mime.startsWith("image/") || /\.(png|jpe?g)$/.test(name);
}

function isPdf(preview = {}) {
  const mime = String(preview.mimeType || "").toLowerCase();
  const name = String(preview.fileName || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

export default function DocumentPreviewModal({ preview, onClose, onDownload }) {
  const onCloseRef = useRef(onClose);
  const isOpen = Boolean(preview);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    // Do not lock <body> scrolling on phones. A body overflow lock can survive a
    // mobile browser/PWA transition or Fast Refresh and leave the Investor App
    // unable to scroll after the preview closes. The fixed preview already owns
    // the full phone viewport, so background locking is unnecessary there.
    const shouldLockBody = window.matchMedia("(min-width: 768px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (shouldLockBody) document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (shouldLockBody) document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (!preview || typeof document === "undefined") return null;

  return createPortal((
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Preview ${preview.fileName || "document"}`}>
      <button type="button" aria-label="Close document preview" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative z-10 flex h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-[90dvh] sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <FileText size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">{preview.title || preview.fileName || "Document preview"}</p>
              <p className="truncate text-[11px] text-slate-500">{preview.fileName || "Secure GrowVest document"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onDownload ? (
              <button type="button" onClick={onDownload} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                <Download size={14} /> <span className="hidden sm:inline">Download</span>
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" aria-label="Close preview">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-4">
          {preview.loading ? (
            <div className="grid h-full place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div>
                <LoaderCircle size={32} className="mx-auto animate-spin text-blue-600" />
                <p className="mt-4 font-semibold text-slate-800">Opening secure document…</p>
                <p className="mt-1 text-sm text-slate-500">The preview will appear here as soon as the file is ready.</p>
              </div>
            </div>
          ) : isImage(preview) && preview.url ? (
            <div className="grid h-full place-items-center overflow-auto rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.title || preview.fileName || "Investor document"} className="max-h-full max-w-full object-contain" />
            </div>
          ) : isPdf(preview) && preview.url ? (
            <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white">
              <iframe src={preview.url} title={preview.fileName || "Investor PDF document"} className="h-full w-full bg-white" />
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div>
                <FileText size={30} className="mx-auto text-slate-400" />
                <p className="mt-3 font-semibold text-slate-800">Preview is not available for this file type.</p>
                <p className="mt-1 text-sm text-slate-500">Use Download to open the original file.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  ), document.body);
}
