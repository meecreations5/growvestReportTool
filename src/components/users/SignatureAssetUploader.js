"use client";

import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import Button from "@/components/ui/Button";
import { uploadStaffSignatureAsset } from "@/services/staffSignatureService";

export default function SignatureAssetUploader({ userId, assetType, label, hint, value, onChange, disabled = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const uploaded = await uploadStaffSignatureAsset({ userId, file, assetType, onProgress: setProgress });
      onChange(uploaded.url);
    } catch (uploadError) {
      setError(uploadError.message || "Image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><ImagePlus size={17} /></span>
      </div>

      {value ? (
        <div className="mt-4 flex min-h-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3">
          <img src={value} alt="Signature asset preview" className="max-h-28 max-w-full object-contain" />
        </div>
      ) : (
        <div className="mt-4 grid min-h-24 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500">No image uploaded</div>
      )}

      {uploading ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500"><span>Uploading…</span><span>{progress}%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} className="hidden" disabled={disabled || uploading} />
        <Button type="button" variant="secondary" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <UploadCloud size={15} />} {value ? "Replace" : "Upload"}
        </Button>
        {value ? <Button type="button" variant="quiet" size="sm" disabled={disabled || uploading} onClick={() => onChange("")}><Trash2 size={15} /> Remove from draft</Button> : null}
      </div>
    </div>
  );
}
