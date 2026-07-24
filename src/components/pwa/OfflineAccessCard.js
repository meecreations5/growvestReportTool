"use client";

import { useEffect, useState } from "react";
import { DatabaseZap, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import { clearIndexedDbPersistence, terminate } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  clearWorkspaceCaches,
  isOfflineAccessEnabled,
  setOfflineAccessPreference
} from "@/lib/utils/offlineAccess";

export default function OfflineAccessCard({ compact = false }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setEnabled(isOfflineAccessEnabled());
  }, []);

  async function changePreference(nextEnabled) {
    setBusy(true);
    setMessage("");
    setOfflineAccessPreference(nextEnabled);
    clearWorkspaceCaches();

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const worker = navigator.serviceWorker.controller || registration.active;
        worker?.postMessage({ type: "SET_OFFLINE_ACCESS", enabled: nextEnabled });
      } catch (error) {
        console.warn("Offline service-worker preference could not be updated", error);
      }
    }

    if (!nextEnabled) {
      try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
      } catch (error) {
        console.warn("Offline Firestore cache could not be cleared immediately", error);
      }
    }

    setEnabled(nextEnabled);
    setMessage(nextEnabled
      ? "Offline access is enabled. Reloading to activate secure local caching…"
      : "Offline access is disabled and locally cached Firestore data has been cleared.");

    window.setTimeout(() => window.location.reload(), 650);
  }

  return (
    <section className={`rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white shadow-[var(--gv-shadow-card)] ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
            {enabled ? <DatabaseZap size={20} /> : <WifiOff size={20} />}
          </span>
          <div>
            <p className="gv-eyebrow">Performance &amp; offline</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-[var(--gv-ink)]">Trusted-device offline access</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">Keep recently used GrowVest data available in this browser for faster repeat loading and limited offline viewing.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          onClick={() => changePreference(!enabled)}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${enabled ? "bg-[var(--gv-blue)]" : "bg-slate-300"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? "left-6" : "left-1"}`} />
          <span className="sr-only">{enabled ? "Disable" : "Enable"} offline access</span>
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <p>Enable this only on a private, trusted device. Reports, documents and generated PDFs are never stored by the service worker; Firestore only retains data that this signed-in browser has already opened.</p>
      </div>

      {message ? <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--gv-blue)]"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{message}</p> : null}
    </section>
  );
}
