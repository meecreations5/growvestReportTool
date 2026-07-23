"use client";

import { useRef, useState } from "react";
import { AppWindow, ImageUp, Smartphone, Trash2, UploadCloud } from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIZE = 512;

function safeName(value = "pwa-icon") {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "pwa-icon";
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be read."));
    };
    image.src = objectUrl;
  });
}

function resizeImageToPng(image, size) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("This browser cannot prepare the PWA icon."));
      return;
    }
    context.clearRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The PWA icon could not be generated."));
    }, "image/png", 1);
  });
}

function uploadBlob(blob, path, metadata, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), blob, {
      contentType: "image/png",
      customMetadata: metadata
    });
    task.on(
      "state_changed",
      (snapshot) => onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes),
      reject,
      async () => resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

function IconPreview({ src, rounded = "rounded-[26%]", label }) {
  return (
    <div className="grid gap-2 text-center">
      <div className={`mx-auto grid h-20 w-20 place-items-center overflow-hidden border border-slate-200 bg-white p-2 shadow-sm ${rounded}`}>
        {src ? <img src={src} alt="" className="h-full w-full object-contain" /> : <ImageUp size={24} className="text-slate-300" />}
      </div>
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
    </div>
  );
}

export default function PwaIconUploader({
  icon192Url,
  icon512Url,
  appleTouchIconUrl,
  maskableIconUrl,
  onChange
}) {
  const standardInputRef = useRef(null);
  const maskableInputRef = useRef(null);
  const [working, setWorking] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [assetInfo, setAssetInfo] = useState("");

  async function validateAndLoad(file) {
    if (!file) return null;
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Upload a PNG, JPG or WebP image.");
    if (file.size > MAX_BYTES) throw new Error("The image must be 5 MB or smaller.");
    const loaded = await loadImage(file);
    const { image } = loaded;
    if (image.naturalWidth !== image.naturalHeight) {
      URL.revokeObjectURL(loaded.objectUrl);
      throw new Error("The PWA icon must be square, for example 512 × 512px.");
    }
    if (image.naturalWidth < MIN_SIZE) {
      URL.revokeObjectURL(loaded.objectUrl);
      throw new Error("Upload a square image of at least 512 × 512px.");
    }
    setAssetInfo(`${image.naturalWidth} × ${image.naturalHeight}px · ${(file.size / 1024).toFixed(0)} KB`);
    return loaded;
  }

  async function selectStandardIcon(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    if (!file) return;

    let loaded;
    try {
      loaded = await validateAndLoad(file);
      if (!loaded) return;
      setWorking("standard");
      setProgress(0);
      const timestamp = Date.now();
      const baseName = safeName(file.name.replace(/\.[^.]+$/, ""));
      const sizes = [192, 512, 180];
      const labels = ["icon-192", "icon-512", "apple-touch-icon"];
      const progressBySize = [0, 0, 0];
      const blobs = await Promise.all(sizes.map((size) => resizeImageToPng(loaded.image, size)));
      const urls = await Promise.all(blobs.map((blob, index) => uploadBlob(
        blob,
        `branding/pwa-icons/${timestamp}-${baseName}-${labels[index]}.png`,
        { assetKey: labels[index], originalName: file.name, generatedSize: String(sizes[index]) },
        (value) => {
          progressBySize[index] = value;
          setProgress(Math.round((progressBySize.reduce((sum, item) => sum + item, 0) / progressBySize.length) * 100));
        }
      )));
      onChange({
        pwaIcon192Url: urls[0],
        pwaIcon512Url: urls[1],
        pwaAppleTouchIconUrl: urls[2]
      });
      setProgress(100);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "The PWA icon could not be uploaded.");
    } finally {
      if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
      setWorking("");
    }
  }

  async function selectMaskableIcon(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setError("");
    if (!file) return;

    let loaded;
    try {
      loaded = await validateAndLoad(file);
      if (!loaded) return;
      setWorking("maskable");
      setProgress(0);
      const blob = await resizeImageToPng(loaded.image, 512);
      const url = await uploadBlob(
        blob,
        `branding/pwa-icons/${Date.now()}-${safeName(file.name.replace(/\.[^.]+$/, ""))}-maskable-512.png`,
        { assetKey: "maskable-icon-512", originalName: file.name, generatedSize: "512" },
        (value) => setProgress(Math.round(value * 100))
      );
      onChange({ pwaMaskableIconUrl: url });
      setProgress(100);
    } catch (nextError) {
      console.error(nextError);
      setError(nextError.message || "The maskable PWA icon could not be uploaded.");
    } finally {
      if (loaded?.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
      setWorking("");
    }
  }

  function removeStandard() {
    onChange({ pwaIcon192Url: "", pwaIcon512Url: "", pwaAppleTouchIconUrl: "" });
    setAssetInfo("");
    setError("");
  }

  function removeMaskable() {
    onChange({ pwaMaskableIconUrl: "" });
    setError("");
  }

  const standardPreview = icon512Url || icon192Url || appleTouchIconUrl;
  const maskablePreview = maskableIconUrl || standardPreview;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 md:col-span-2">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white"><AppWindow size={19} /></span>
            <div>
              <p className="text-sm font-bold text-slate-950">PWA / home-screen app icon</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Used when Investors install GrowVest on Android, iPhone, iPad or desktop. Upload once and the system generates the required 192px, 512px and Apple touch variants.</p>
              <p className="mt-1 text-[11px] font-semibold text-blue-700">Required: square PNG, JPG or WebP · minimum 512 × 512px</p>
            </div>
          </div>

          {assetInfo ? <p className="mt-3 text-[11px] text-slate-500">Selected asset: {assetInfo}</p> : null}
          {working ? (
            <div className="mt-4 max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-700" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1 text-xs font-semibold text-blue-700">Preparing PWA icon variants {progress}%</p>
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => standardInputRef.current?.click()} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><UploadCloud size={15} />{standardPreview ? "Replace PWA icon" : "Upload PWA icon"}</button>
            {standardPreview ? <button type="button" onClick={removeStandard} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} />Remove from draft</button> : null}
          </div>
          <input ref={standardInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectStandardIcon} />
        </div>

        <div className="flex min-w-[250px] items-start justify-center gap-6 rounded-2xl border border-blue-100 bg-white p-5">
          <IconPreview src={standardPreview} label="Android / Desktop" />
          <IconPreview src={appleTouchIconUrl || standardPreview} rounded="rounded-[22%]" label="iPhone / iPad" />
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-blue-100 pt-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Smartphone size={17} /></span>
          <div>
            <p className="text-sm font-bold text-slate-950">Optional Android maskable icon</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Use a 512 × 512px icon with the important logo artwork inside the central 80% safe zone. When omitted, the standard PWA icon is used.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => maskableInputRef.current?.click()} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-60"><UploadCloud size={15} />{maskableIconUrl ? "Replace maskable icon" : "Upload maskable icon"}</button>
              {maskableIconUrl ? <button type="button" onClick={removeMaskable} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} />Remove</button> : null}
            </div>
            <input ref={maskableInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectMaskableIcon} />
          </div>
        </div>
        <IconPreview src={maskablePreview} rounded="rounded-full" label="Adaptive crop preview" />
      </div>

      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">The icon becomes live only after <strong>Publish Branding</strong>. Browsers can cache an already-installed icon; existing users may need to refresh or reinstall the PWA before the new home-screen icon appears.</p>
    </section>
  );
}
