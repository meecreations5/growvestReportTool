"use client";

import { useRef, useState } from "react";
import { FileType2, Trash2, UploadCloud } from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

const ALLOWED_EXTENSIONS = ["woff2", "woff"];
const MAX_BYTES = 2 * 1024 * 1024;

function safeName(value = "font") {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "font";
}

export default function BrandFontUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");

  function removeCurrent() {
    onChange("");
    setFileName("");
    setError("");
  }

  function selectFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Upload a licensed WOFF2 or WOFF webfont file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("The webfont must be 2 MB or smaller.");
      return;
    }

    setFileName(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
    setWorking(true);
    setProgress(0);
    const path = `branding-fonts/signature-script/${Date.now()}-${safeName(file.name)}`;
    const contentType = extension === "woff2" ? "font/woff2" : "font/woff";
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType,
      customMetadata: { assetKey: "signature-script-font", originalName: file.name }
    });

    task.on(
      "state_changed",
      (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
      (nextError) => {
        console.error(nextError);
        setError(nextError.message || "The webfont could not be uploaded.");
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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {value ? <style>{`@font-face{font-family:'Emitha';src:url('${value}') format('${value.toLowerCase().includes(".woff2") ? "woff2" : "woff"}');font-style:normal;font-weight:400;font-display:swap}`}</style> : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">Emitha signature webfont</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Upload the organisation's licensed Emitha WOFF2 or WOFF file. Supporting email clients use it for the given name; other clients use the script fallback.</p>
          <p className="mt-1 text-[11px] font-semibold text-blue-700">Recommended: WOFF2, maximum 2 MB</p>
        </div>
        <FileType2 size={18} className="shrink-0 text-blue-700" />
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-3xl text-red-500" style={{ fontFamily: value ? "Emitha, 'Segoe Script', cursive" : "'Segoe Script', cursive" }}>Suraj</p>
        <p className="mt-2 text-xs font-semibold text-slate-500">{value ? fileName || "Licensed webfont configured" : "No Emitha webfont uploaded"}</p>
      </div>

      {working ? <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs font-semibold text-blue-700">Uploading {progress}%</p></div> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={working} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><UploadCloud size={15} />{value ? "Replace" : "Upload"}</button>
        {value ? <button type="button" onClick={removeCurrent} disabled={working} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} />Remove from draft</button> : null}
      </div>
      <input ref={inputRef} type="file" accept=".woff2,.woff,font/woff2,font/woff" className="hidden" onChange={selectFile} />
    </div>
  );
}
