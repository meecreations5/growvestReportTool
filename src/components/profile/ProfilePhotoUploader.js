"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, LoaderCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfileImage, validateProfileImage } from "@/services/profileImageService";

function initials(name) {
  return String(name || "GV").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function ProfilePhotoUploader({ className = "", compact = false, onUploaded }) {
  const inputRef = useRef(null);
  const { profile, refreshProfile } = useAuth();
  const [preview, setPreview] = useState(profile?.photoURL || "");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file) {
    const validationError = validateProfileImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setMessage("");
    setPreview(URL.createObjectURL(file));
    setSaving(true);
    setProgress(0);
    try {
      const photoURL = await uploadProfileImage({ uid: profile?.id || profile?.uid, file, onProgress: setProgress });
      setPreview(photoURL);
      await refreshProfile();
      setMessage("Profile image updated.");
      onUploaded?.(photoURL);
    } catch (uploadError) {
      console.error(uploadError);
      setError(uploadError.message || "Unable to upload profile image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <div className={`flex ${compact ? "items-center gap-3" : "flex-col items-center gap-4 sm:flex-row sm:items-center"}`}>
        <div className={`relative shrink-0 ${compact ? "h-16 w-16" : "h-28 w-28"}`}>
          {preview ? <img src={preview} alt={profile?.fullName || "Profile"} className="h-full w-full rounded-full border-4 border-white object-cover shadow-lg" /> : <span className="grid h-full w-full place-items-center rounded-full border-4 border-white bg-[var(--gv-blue)] font-heading text-2xl font-bold text-white shadow-lg">{initials(profile?.fullName)}</span>}
          <button type="button" onClick={() => inputRef.current?.click()} className="absolute bottom-0 right-0 grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-[var(--gv-blue)] text-white shadow-md" aria-label="Upload profile image" title="Upload profile image"><Camera size={17} /></button>
        </div>
        <div className={compact ? "min-w-0" : "text-center sm:text-left"}>
          <p className="font-heading text-lg font-bold text-[var(--gv-ink)]">Profile image</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">PNG, JPG or WebP. Maximum 5 MB. A square image works best.</p>
          {!compact ? <button type="button" onClick={() => inputRef.current?.click()} disabled={saving} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <ImageUp size={16} />}{saving ? `Uploading ${progress}%` : "Choose image"}</button> : null}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); event.target.value = ""; }} />
      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
      {message ? <p className="mt-3 text-sm font-semibold text-emerald-600">{message}</p> : null}
    </div>
  );
}
