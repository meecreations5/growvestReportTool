"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { Download, History } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { downloadReportPdf } from "@/services/communicationService";

function displayDate(value) {
  if (!value) return "—";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReportVersionHistory({ reportId, activeVersionId }) {
  const [versions, setVersions] = useState([]);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "reportVersions"), where("reportId", "==", reportId), orderBy("publishedVersion", "desc"), limit(20)),
    (snapshot) => setVersions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (nextError) => {
      console.error(nextError);
      setError("Unable to load published version history.");
    }
  ), [reportId]);

  async function handleDownload(versionId) {
    setWorkingId(versionId);
    setError("");
    try {
      await downloadReportPdf(reportId, versionId);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3"><History className="text-blue-700" size={20} /><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Version control</p><h2 className="text-lg font-black text-slate-950">Published report history</h2></div></div>
      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-3">
        {versions.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-950">Published version {item.publishedVersion || 1}</p>{item.id === activeVersionId ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">Active</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">Superseded</span>}</div>
              <p className="mt-1 text-xs text-slate-500">Published {displayDate(item.publishedAt)} by {item.publishedByName || "GrowVest"} · Source working version {item.sourceReportVersion || "—"}</p>
            </div>
            <button type="button" onClick={() => handleDownload(item.id)} disabled={workingId === item.id || !item.pdfStoragePath} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50"><Download size={16} />{workingId === item.id ? "Preparing…" : "Download PDF"}</button>
          </div>
        ))}
        {!versions.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Published versions will appear after the report is published.</p> : null}
      </div>
    </section>
  );
}
