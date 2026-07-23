"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2, UploadCloud } from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function safeName(value = "asset") {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function imageDimensions(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

export default function BrandAssetUploader({
  label,
  assetKey,
  value,
  onChange,
  hint,
  recommended,
  compact = false,
  previewTone = "light",
  previewClassName = ""
}) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [assetInfo, setAssetInfo] = useState("");

  function removeCurrent() {
    // Branding versions and published reports may still reference the existing
    // Firebase Storage URL. Clear the draft reference without deleting the file.
    onChange("");
    setAssetInfo("");
    setError("");
  }

  async function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Upload a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The image must be 5 MB or smaller.");
      return;
    }

    const dimensions = await imageDimensions(file);
    setAssetInfo(`${dimensions ? `${dimensions.width} × ${dimensions.height}px · ` : ""}${(file.size / 1024).toFixed(0)} KB`);

    setWorking(true);
    setProgress(0);
    const path = `branding/${assetKey}/${Date.now()}-${safeName(file.name)}`;
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type,
      customMetadata: { assetKey, originalName: file.name }
    });

    task.on(
      "state_changed",
      (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (nextError) => {
        console.error(nextError);
        setError(nextError.message || "The image could not be uploaded.");
        setWorking(false);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onChange(url);
        setProgress(100);
        setWorking(false);
      }
    );
  }

  const previewBackground = previewTone === "dark"
    ? "bg-[#0B0B0F]"
    : previewTone === "checker"
      ? "bg-slate-100"
      : "bg-white";

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50/70 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{label}</p>
          {hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p> : null}
          {recommended ? <p className="mt-1 text-[11px] font-semibold text-blue-700">Recommended: {recommended}</p> : null}
        </div>
        <ImageUp size={18} className="shrink-0 text-blue-700" />
      </div>

      <div className={`mt-4 flex min-h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 p-4 ${previewBackground} ${previewClassName}`}>
        {value ? <img src={value} alt={`${label} preview`} className="max-h-24 max-w-full object-contain" /> : <p className={`text-center text-xs font-semibold ${previewTone === "dark" ? "text-white/50" : "text-slate-400"}`}>No image uploaded</p>}
      </div>

      {assetInfo ? <p className="mt-2 text-[11px] text-slate-500">Selected asset: {assetInfo}</p> : null}
      {working ? <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs font-semibold text-blue-700">Uploading {progress}%</p></div> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={working} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><UploadCloud size={15} />{value ? "Replace" : "Upload"}</button>
        {value ? <button type="button" onClick={removeCurrent} disabled={working} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} />Remove from draft</button> : null}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectFile} />
    </div>
  );
}
