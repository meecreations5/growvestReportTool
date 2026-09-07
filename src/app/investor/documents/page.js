"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileClock,
  FileText,
  FileUp,
  ShieldCheck,
  Upload,
  MoreHorizontal
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadInvestorDocument,
  uploadInvestorDocument,
  viewInvestorDocument
} from "@/services/documentService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";
import { getInvestorAppData } from "@/services/investorAppService";
import { MobileEmptyState } from "@/components/investor/mobile/InvestorMobilePrimitives";

const statusStyles = {
  requested: "border-amber-200 bg-amber-50 text-amber-700",
  uploaded: "border-blue-200 bg-blue-50 text-blue-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  expired: "border-slate-200 bg-slate-100 text-slate-600"
};

const statusCopy = {
  requested: "Upload the requested file for GrowVest review.",
  uploaded: "Your file has been received and is awaiting verification.",
  verified: "GrowVest has verified this document.",
  rejected: "Review the GrowVest note and upload a corrected file.",
  expired: "This document has expired. Upload a current copy."
};

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InvestorDocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [workingId, setWorkingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState("all");
  const [actionMenuId, setActionMenuId] = useState("");
  const previewAbortRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function loadDocuments() {
      if (!profile?.investorId) { setLoading(false); return; }
      setLoading(true);
      try {
        const payload = await getInvestorAppData("documents");
        if (!active) return;
        setDocuments(payload.documents || []);
        setError("");
      } catch (nextError) {
        console.error("Investor documents load failed", nextError);
        if (active) setError(nextError?.message || "Unable to load your documents. Please try again.");
      } finally { if (active) setLoading(false); }
    }
    loadDocuments();
    return () => { active = false; };
  }, [profile?.investorId]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  useEffect(() => () => {
    previewAbortRef.current?.abort();
  }, []);

  const counts = useMemo(
    () => ({
      requested: documents.filter((item) => item.status === "requested" || item.status === "rejected" || item.status === "expired").length,
      uploaded: documents.filter((item) => item.status === "uploaded").length,
      verified: documents.filter((item) => item.status === "verified").length
    }),
    [documents]
  );

  const filteredDocuments = useMemo(() => documents.filter((item) => {
    if (filter === "action") return ["requested", "rejected", "expired"].includes(item.status);
    if (filter === "review") return item.status === "uploaded";
    if (filter === "verified") return item.status === "verified";
    return true;
  }), [documents, filter]);

  async function handleUpload(item, file) {
    if (!file) return;
    const actionKey = `upload:${item.id}`;
    setWorkingId(actionKey);
    setError("");
    setNotice("");

    try {
      await uploadInvestorDocument(item, file, profile);
      setNotice(`${file.name} uploaded successfully. GrowVest will review it.`);
      const payload = await getInvestorAppData("documents", { force: true }).catch(() => null);
      if (payload?.documents) setDocuments(payload.documents);
    } catch (nextError) {
      setError(nextError?.message || "The document could not be uploaded.");
    } finally {
      setWorkingId((current) => current === actionKey ? "" : current);
    }
  }

  async function handleDownload(item) {
    const actionKey = `download:${item.id}`;
    setWorkingId(actionKey);
    setError("");

    try {
      await downloadInvestorDocument(item);
    } catch (nextError) {
      setError(nextError?.message || "The document could not be downloaded.");
    } finally {
      setWorkingId((current) => current === actionKey ? "" : current);
    }
  }

  async function handleView(item) {
    const actionKey = `view:${item.id}`;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setWorkingId(actionKey);
    setError("");
    setPreview({
      loading: true,
      title: item.title || item.documentType || "Document",
      fileName: item.fileName || "GrowVest-document",
      mimeType: item.mimeType || "",
      documentRecord: item
    });

    try {
      const securePreview = await viewInvestorDocument(item, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setPreview({ ...securePreview, loading: false, title: item.title || item.documentType || "Document", documentRecord: item });
    } catch (nextError) {
      if (controller.signal.aborted) return;
      setPreview(null);
      setError(nextError?.message || "The document could not be opened.");
    } finally {
      if (previewAbortRef.current === controller) previewAbortRef.current = null;
      setWorkingId((current) => current === actionKey ? "" : current);
    }
  }

  function closePreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    setPreview(null);
  }

  return (
    <div className="gv-mobile-fit grid gap-4 sm:gap-6">
      <InvestorPageHeader
        eyebrow="Secure document centre"
        title="Documents"
        description="Upload documents requested by GrowVest and follow their verification status."
      />

      {/* Phone-only compact explainer. Keep the fuller desktop guidance from 768px upwards. */}
      <details className="gv-mobile-brand-panel overflow-hidden rounded-[22px] border p-0 md:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-[var(--gv-ink)]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white text-[var(--gv-blue)] shadow-sm">
            <ShieldCheck size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--gv-blue)]">Secure uploads</span>
            <span className="block font-heading text-sm font-bold">How document upload works</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-[var(--gv-blue)]">View</span>
        </summary>
        <div className="border-t border-[var(--gv-border)] px-4 pb-4 pt-3 text-[13px] leading-5 text-slate-600">
          <ol className="grid gap-2">
            <li><strong className="text-[var(--gv-blue)]">1.</strong> GrowVest creates a document request.</li>
            <li><strong className="text-[var(--gv-blue)]">2.</strong> Upload the requested file from this screen.</li>
            <li><strong className="text-[var(--gv-blue)]">3.</strong> GrowVest reviews and verifies it securely.</li>
          </ol>
          <p className="mt-3 text-[11px] font-semibold text-slate-500">PDF, JPG or PNG · Maximum 10 MB</p>
        </div>
      </details>

      <section className="hidden rounded-[var(--gv-radius-lg)] border border-blue-100 bg-blue-50 p-4 md:block sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[var(--gv-blue)] shadow-sm">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold text-blue-950">How document upload works</h2>
            <div className="mt-3 grid gap-2 text-sm text-blue-900 sm:grid-cols-3">
              <p><strong>1.</strong> GrowVest creates a document request.</p>
              <p><strong>2.</strong> The request appears here with an Upload button.</p>
              <p><strong>3.</strong> GrowVest reviews and verifies the uploaded file.</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-blue-700">
              Accepted formats: PDF, JPG and PNG. Maximum file size: 10 MB.
            </p>
          </div>
        </div>
      </section>

      {/* Compact app summary on phones: one contained strip, not three competing cards. */}
      <section className="hidden">
        {[
          ["Action", counts.requested, FileClock, "text-[var(--gv-warning)]"],
          ["Review", counts.uploaded, FileUp, "text-[var(--gv-cyan)]"],
          ["Verified", counts.verified, FileCheck2, "text-[var(--gv-blue)]"]
        ].map(([label, value, Icon, tone]) => (
          <article key={label} className="min-w-0 px-2 py-3 text-center">
            <Icon size={16} className={`mx-auto ${tone}`} />
            <p className="mt-1 font-heading text-xl font-bold text-[var(--gv-ink)]">{value}</p>
            <p className="truncate text-[9px] font-black uppercase tracking-[0.07em] text-slate-400">{label}</p>
          </article>
        ))}
      </section>

      <div className="gv-mobile-scroll flex gap-2 overflow-x-auto pb-1 md:hidden">
        {[
          ["all", "All"],
          ["action", `Action ${counts.requested}`],
          ["review", `Review ${counts.uploaded}`],
          ["verified", `Verified ${counts.verified}`]
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`min-h-9 shrink-0 rounded-full px-3 text-[10px] font-black ${filter === value ? "bg-[var(--gv-blue)] text-white" : "border border-slate-200 bg-white text-slate-500"}`}>{label}</button>
        ))}
      </div>

      <section className="hidden grid-cols-3 gap-3 md:grid">
        {[
          ["Action needed", counts.requested, FileClock],
          ["Under review", counts.uploaded, FileUp],
          ["Verified", counts.verified, FileCheck2]
        ].map(([label, value, Icon]) => (
          <article
            key={label}
            className="rounded-2xl border border-[var(--gv-border)] bg-white p-3 text-center shadow-[var(--gv-shadow-card)] sm:p-4"
          >
            <Icon size={18} className="mx-auto text-[var(--gv-blue)]" />
            <p className="mt-2 font-heading text-2xl font-bold text-[var(--gv-ink)]">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          </article>
        ))}
      </section>

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          {notice}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2.5 md:hidden"><div className="gv-skeleton h-16 rounded-[18px]" /><div className="gv-skeleton h-16 rounded-[18px]" /><div className="gv-skeleton h-16 rounded-[18px]" /></div>
      ) : filteredDocuments.length ? (
        <section className="gv-mobile-deferred overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,.04)] md:hidden">
          {filteredDocuments.map((item, index) => {
            const isWorking = workingId.endsWith(`:${item.id}`);
            const isUploading = workingId === `upload:${item.id}`;
            const isViewing = workingId === `view:${item.id}`;
            const isDownloading = workingId === `download:${item.id}`;
            const hasFile = Boolean(item.storagePath);
            const statusTone = item.status === "verified" ? "text-emerald-600 bg-emerald-50" : item.status === "uploaded" ? "text-[var(--gv-blue)] bg-blue-50" : "text-amber-700 bg-amber-50";
            return (
              <div key={item.id} className={`relative ${index ? "border-t border-slate-100" : ""}`}>
                <div className="flex min-h-[72px] items-center gap-3 px-3.5 py-3">
                  <button type="button" onClick={() => hasFile ? handleView(item) : null} disabled={!hasFile || isWorking} className={`grid h-10 w-10 shrink-0 place-items-center rounded-[13px] ${statusTone}`} aria-label={hasFile ? `Open ${item.title}` : item.title}>
                    {item.status === "verified" ? <FileCheck2 size={17} /> : hasFile ? <FileUp size={17} /> : <FileText size={17} />}
                  </button>
                  <button type="button" onClick={() => hasFile ? handleView(item) : null} disabled={!hasFile || isWorking} className="min-w-0 flex-1 text-left disabled:cursor-default">
                    <span className="block truncate text-[12px] font-extrabold text-slate-950">{item.title || item.documentType || "Document"}</span>
                    <span className="mt-0.5 block truncate text-[9px] text-slate-400">{item.documentType || "Personal"}{item.fileName ? ` · ${item.fileName}` : ""}</span>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black capitalize ${item.status === "verified" ? "bg-emerald-50 text-emerald-700" : item.status === "uploaded" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{item.status || "requested"}</span>
                  </button>
                  {!hasFile ? (
                    <label className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--gv-blue)] px-3 text-[9px] font-black text-white">
                      {isUploading ? "Uploading" : "Upload"}
                      <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={isWorking} onChange={(event) => { handleUpload(item, event.target.files?.[0]); event.target.value = ""; }} />
                    </label>
                  ) : (
                    <button type="button" onClick={() => setActionMenuId((current) => current === item.id ? "" : item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500" aria-label={`More actions for ${item.title}`}><MoreHorizontal size={16} /></button>
                  )}
                </div>
                {hasFile && actionMenuId === item.id ? (
                  <div className="grid grid-cols-3 gap-1 border-t border-slate-100 bg-slate-50/70 p-2.5">
                    <button type="button" onClick={() => handleView(item)} disabled={isWorking} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-[11px] bg-white text-[9px] font-black text-[var(--gv-blue)] shadow-sm"><Eye size={13} /> {isViewing ? "Opening" : "View"}</button>
                    <button type="button" onClick={() => handleDownload(item)} disabled={isWorking} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-[11px] bg-white text-[9px] font-black text-slate-600 shadow-sm"><Download size={13} /> {isDownloading ? "Saving" : "Download"}</button>
                    <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-[11px] bg-white text-[9px] font-black text-slate-600 shadow-sm"><Upload size={13} /> {isUploading ? "Uploading" : "Replace"}<input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={isWorking} onChange={(event) => { handleUpload(item, event.target.files?.[0]); event.target.value = ""; }} /></label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : <div className="md:hidden"><MobileEmptyState icon={FileText} title="No documents in this view" copy="Your secure document requests and verified files will appear here." /></div>}

      {loading ? (
        <section className="hidden gap-4 md:grid md:grid-cols-2"><div className="gv-skeleton h-64 rounded-2xl" /><div className="gv-skeleton h-64 rounded-2xl" /></section>
      ) : (
      <section className="hidden gap-4 md:grid md:grid-cols-2">
        {filteredDocuments.map((item) => {
          const isWorking = workingId.endsWith(`:${item.id}`);
          const isUploading = workingId === `upload:${item.id}`;
          const isViewing = workingId === `view:${item.id}`;
          const isDownloading = workingId === `download:${item.id}`;
          const needsUpload = !item.storagePath || ["requested", "rejected", "expired"].includes(item.status);

          return (
            <article
              key={item.id}
              className="gv-mobile-fit overflow-hidden rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-4 shadow-[var(--gv-shadow-card)] sm:p-5"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]">
                  {item.status === "verified" ? <FileCheck2 size={20} /> : item.storagePath ? <FileUp size={20} /> : <FileText size={20} />}
                </span>
                <span className={`max-w-[46%] shrink-0 truncate rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize sm:max-w-none sm:px-3 ${statusStyles[item.status] || statusStyles.requested}`}>
                  {item.status || "requested"}
                </span>
              </div>

              <h2 className="gv-mobile-wrap mt-4 font-heading text-xl font-bold leading-tight text-[var(--gv-ink)]">{item.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {item.documentType || "Document"}
                {item.dueDate ? ` · Due ${item.dueDate}` : ""}
              </p>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {statusCopy[item.status] || statusCopy.requested}
              </p>

              {item.notes ? (
                <div className="mt-4 rounded-xl bg-[var(--gv-surface)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">GrowVest note</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{item.notes}</p>
                </div>
              ) : null}

              {item.verificationNote ? (
                <div className={`mt-4 rounded-xl p-3 text-sm ${item.status === "rejected" ? "bg-red-50 text-red-700" : "bg-[var(--gv-surface)] text-slate-600"}`}>
                  <strong>GrowVest note:</strong> {item.verificationNote}
                </div>
              ) : null}

              {item.fileName ? (
                <div className="gv-mobile-fit mt-4 flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{item.fileName}</p>
                    <p className="text-[10px] text-slate-400">{formatFileSize(item.sizeBytes)}</p>
                  </div>
                  <FileCheck2 size={17} className="shrink-0 text-emerald-600" />
                </div>
              ) : null}

              {/* Phone actions use a clear app hierarchy. View is primary, Download secondary, Replace tertiary. */}
              {item.storagePath ? <div className="mt-5 grid grid-cols-2 gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => handleView(item)}
                  disabled={isWorking}
                  className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-3 text-sm font-bold text-white shadow-[var(--gv-shadow-card)] transition active:scale-[.99] disabled:opacity-60"
                >
                  <Eye size={17} /> {isViewing ? "Opening…" : "View"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  disabled={isWorking}
                  className="gv-mobile-cyan-soft inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold text-[var(--gv-blue)] transition active:scale-[.99] disabled:opacity-60"
                >
                  <Download size={17} /> {isDownloading ? "Saving…" : "Download"}
                </button>
                <label className="col-span-2 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-bold text-[var(--gv-blue)] transition active:bg-[var(--gv-blue-soft)]">
                  <Upload size={15} /> {isUploading ? "Uploading…" : "Replace file"}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    disabled={isWorking}
                    onChange={(event) => {
                      handleUpload(item, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div> : null}

              {!item.storagePath ? <div className="mt-5 md:hidden">
                <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-3 text-sm font-bold text-white shadow-[var(--gv-shadow-card)]">
                  <Upload size={17} /> {isUploading ? "Uploading…" : "Upload document"}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    disabled={isWorking}
                    onChange={(event) => {
                      handleUpload(item, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div> : null}

              <div className={`mt-5 hidden gap-2 md:grid ${item.storagePath ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
                <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-3 text-sm font-bold text-white transition hover:bg-[var(--gv-blue-strong)]">
                  <Upload size={17} />
                  {isUploading ? "Uploading…" : needsUpload ? "Upload document" : "Replace file"}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    disabled={isWorking}
                    onChange={(event) => {
                      handleUpload(item, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>

                {item.storagePath ? (
                  <button
                    type="button"
                    onClick={() => handleView(item)}
                    disabled={isWorking}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                  >
                    <Eye size={17} /> {isViewing ? "Opening…" : "View"}
                  </button>
                ) : null}

                {item.storagePath ? (
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    disabled={isWorking}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Download size={17} /> {isDownloading ? "Downloading…" : "Download"}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}

        {!filteredDocuments.length ? (
          <div className="md:col-span-2">
            <MobileEmptyState
              icon={FileCheck2}
              title={documents.length ? "No documents in this view" : "No document requests yet"}
              copy={documents.length ? "Choose another document status to continue." : "GrowVest document requests will appear here when something is required from you."}
            />
          </div>
        ) : null}
      </section>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} />
        <p>Uploaded documents are stored securely and are accessible only to authorised GrowVest users.</p>
      </div>

      <DocumentPreviewModal
        preview={preview}
        onClose={closePreview}
        onDownload={() => preview?.documentRecord ? handleDownload(preview.documentRecord) : null}
      />
    </div>
  );
}
