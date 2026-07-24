"use client";

import { useRef, useState } from "react";
import { AppWindow, ImageUp, Info, Smartphone, Trash2, UploadCloud } from "lucide-react";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "@/lib/firebase/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIZE = 512;

function safeName(value = "pwa-icon") {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "pwa-icon";
}

function safeHex(value = "#1F4ED8") {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#1F4ED8";
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

function resizeImageToPng(image, size, { backgroundColor = "#1F4ED8", scale = 1 } = {}) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("This browser cannot prepare the PWA icon."));
      return;
    }

    context.fillStyle = safeHex(backgroundColor);
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const maxWidth = size * scale;
    const maxHeight = size * scale;
    const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = image.naturalWidth * ratio;
    const height = image.naturalHeight * ratio;
    const x = (size - width) / 2;
    const y = (size - height) / 2;
    context.drawImage(image, x, y, width, height);

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

function IconPreview({ src, rounded = "rounded-[26%]", label, caption }) {
  return (
    <div className="grid gap-2 text-center">
      <div className={`mx-auto grid h-20 w-20 place-items-center overflow-hidden border border-slate-200 bg-slate-100 shadow-sm ${rounded}`}>
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ImageUp size={24} className="text-slate-300" />}
      </div>
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      {caption ? <span className="max-w-24 text-[9px] leading-3 text-slate-400">{caption}</span> : null}
    </div>
  );
}

function IdentityField({ label, value, onChange, maxLength, hint }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</span>
      <input
        value={value || ""}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {hint ? <span className="text-[10px] leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export default function PwaIconUploader({
  icon192Url,
  icon512Url,
  appleTouchIconUrl,
  maskableIconUrl,
  appName,
  shortName,
  tagline,
  primaryColor,
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
      const backgroundColor = safeHex(primaryColor);
      const outputs = [
        { size: 192, label: "icon-192", scale: 1 },
        { size: 512, label: "icon-512", scale: 1 },
        { size: 180, label: "apple-touch-icon", scale: 1 },
        { size: 512, label: "maskable-icon-512", scale: 0.72 }
      ];
      const progressBySize = outputs.map(() => 0);
      const blobs = await Promise.all(outputs.map((output) => resizeImageToPng(loaded.image, output.size, {
        backgroundColor,
        scale: output.scale
      })));
      const urls = await Promise.all(blobs.map((blob, index) => uploadBlob(
        blob,
        `branding/pwa-icons/${timestamp}-${baseName}-${outputs[index].label}.png`,
        {
          assetKey: outputs[index].label,
          originalName: file.name,
          generatedSize: String(outputs[index].size),
          generatedBackground: backgroundColor
        },
        (value) => {
          progressBySize[index] = value;
          setProgress(Math.round((progressBySize.reduce((sum, item) => sum + item, 0) / progressBySize.length) * 100));
        }
      )));
      onChange({
        pwaIcon192Url: urls[0],
        pwaIcon512Url: urls[1],
        pwaAppleTouchIconUrl: urls[2],
        pwaMaskableIconUrl: urls[3]
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
      const backgroundColor = safeHex(primaryColor);
      const blob = await resizeImageToPng(loaded.image, 512, { backgroundColor, scale: 0.78 });
      const url = await uploadBlob(
        blob,
        `branding/pwa-icons/${Date.now()}-${safeName(file.name.replace(/\.[^.]+$/, ""))}-maskable-512.png`,
        {
          assetKey: "maskable-icon-512",
          originalName: file.name,
          generatedSize: "512",
          generatedBackground: backgroundColor
        },
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
    onChange({ pwaIcon192Url: "", pwaIcon512Url: "", pwaAppleTouchIconUrl: "", pwaMaskableIconUrl: "" });
    setAssetInfo("");
    setError("");
  }

  function removeMaskable() {
    onChange({ pwaMaskableIconUrl: "" });
    setError("");
  }

  const standardPreview = icon512Url || icon192Url || appleTouchIconUrl;
  const maskablePreview = maskableIconUrl || "/icons/growvest-pwa-maskable-512.png";
  const labelPreview = shortName || "GrowVest";
  const taglinePreview = tagline || "Your Conscious Wealth Partner";

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 md:col-span-2">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-white"><AppWindow size={19} /></span>
        <div>
          <p className="text-sm font-bold text-slate-950">PWA identity and home-screen icon</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Controls the installed GrowVest Investor app name, brand message, Android adaptive icon, Apple touch icon and desktop PWA icon.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 rounded-2xl border border-blue-100 bg-white p-4 md:grid-cols-3">
        <IdentityField
          label="Full installed app name"
          value={appName}
          maxLength={70}
          onChange={(value) => onChange({ pwaAppName: value })}
          hint="Used in install prompts, app information and supported splash surfaces."
        />
        <IdentityField
          label="Home-screen short name"
          value={shortName}
          maxLength={18}
          onChange={(value) => onChange({ pwaShortName: value })}
          hint="Keep this short. Android normally shows only this label below the icon."
        />
        <IdentityField
          label="PWA brand message"
          value={tagline}
          maxLength={60}
          onChange={(value) => onChange({ pwaTagline: value })}
          hint="Recommended: Your Conscious Wealth Partner."
        />
      </div>

      <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-slate-950">App icon artwork</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Upload a square GrowVest symbol or app mark. Avoid a wide wordmark or small tagline inside the icon because launcher icons are displayed at very small sizes.</p>
          <p className="mt-1 text-[11px] font-semibold text-blue-700">Required: square PNG, JPG or WebP · minimum 512 × 512px</p>

          {assetInfo ? <p className="mt-3 text-[11px] text-slate-500">Selected asset: {assetInfo}</p> : null}
          {working ? (
            <div className="mt-4 max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-700" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1 text-xs font-semibold text-blue-700">Preparing standard, Apple and adaptive icons {progress}%</p>
            </div>
          ) : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => standardInputRef.current?.click()} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><UploadCloud size={15} />{standardPreview ? "Replace PWA icon" : "Upload PWA icon"}</button>
            {standardPreview ? <button type="button" onClick={removeStandard} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} />Remove from draft</button> : null}
          </div>
          <input ref={standardInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectStandardIcon} />
        </div>

        <div className="min-w-[290px] rounded-2xl border border-blue-100 bg-white p-5">
          <div className="flex items-start justify-center gap-6">
            <IconPreview src={standardPreview} label="Android / Desktop" caption={labelPreview} />
            <IconPreview src={appleTouchIconUrl || standardPreview} rounded="rounded-[22%]" label="iPhone / iPad" caption={labelPreview} />
            <IconPreview src={maskablePreview} rounded="rounded-full" label="Adaptive crop" caption={labelPreview} />
          </div>
          <p className="mt-4 text-center text-[10px] font-semibold text-slate-500">{taglinePreview}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-blue-100 pt-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-blue-700 shadow-sm"><Smartphone size={17} /></span>
          <div>
            <p className="text-sm font-bold text-slate-950">Android adaptive icon</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">A safe-zone maskable icon is generated automatically whenever the main icon is uploaded. Upload a separate maskable version only when the automatically generated crop needs adjustment.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => maskableInputRef.current?.click()} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-60"><UploadCloud size={15} />{maskableIconUrl ? "Replace adaptive icon" : "Upload adaptive icon"}</button>
              {maskableIconUrl ? <button type="button" onClick={removeMaskable} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"><Trash2 size={15} />Use default</button> : null}
            </div>
            <input ref={maskableInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={selectMaskableIcon} />
          </div>
        </div>
        <div className="flex max-w-sm items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
          <Info size={15} className="mt-0.5 shrink-0" /> Android does not provide a separate second-line tagline below the icon. It normally shows the short name only; the full name and brand message appear in the install, app and supported splash experience.
        </div>
      </div>

      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">The icon and PWA identity become live only after <strong>Publish Branding</strong>. Installed apps cache their manifest and icon; existing users should remove the old shortcut/PWA and install it again after deployment.</p>
    </section>
  );
}
