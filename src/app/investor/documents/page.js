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
  Upload
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadInvestorDocument,
  subscribeInvestorPortalDocuments,
  uploadInvestorDocument,
  viewInvestorDocument
} from "@/services/documentService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const previewAbortRef = useRef(null);

  useEffect(() => {
    if (!profile?.investorId) return () => {};

    return subscribeInvestorPortalDocuments(
      profile.investorId,
      (records) => {
        setDocuments(records);
        setError("");
      },
      (nextError) => {
        console.error("Investor documents subscription failed", nextError);

        if (nextError?.code === "permission-denied") {
          setError(
            "Document access is not fully linked to this Investor account. Please contact your GrowVest Advisor."
          );
          return;
        }

        setError("Unable to load your documents. Please try again.");
      }
    );
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

  async function handleUpload(item, file) {
    if (!file) return;
    const actionKey = `upload:${item.id}`;
    setWorkingId(actionKey);
    setError("");
    setNotice("");

    try {
      await uploadInvestorDocument(item, file, profile);
      setNotice(`${file.name} uploaded successfully. GrowVest will review it.`);
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
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader
        eyebrow="Secure document centre"
        title="Documents"
        description="Upload documents requested by GrowVest and follow their verification status."
      />

      <section className="rounded-[var(--gv-radius-lg)] border border-blue-100 bg-blue-50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[var(--gv-blue)] shadow-sm">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold text-blue-950">How document upload works</h2>
            <div className="mt-3 grid gap-2 text-sm text-blue-900 sm:grid-cols-3">
              <p><strong>1.</strong> Your Advisor creates a document request.</p>
              <p><strong>2.</strong> The request appears here with an Upload button.</p>
              <p><strong>3.</strong> GrowVest reviews and verifies the uploaded file.</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-blue-700">
              Accepted formats: PDF, JPG and PNG. Maximum file size: 10 MB.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
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

      <section className="grid gap-4 md:grid-cols-2">
        {documents.map((item) => {
          const isWorking = workingId.endsWith(`:${item.id}`);
          const isUploading = workingId === `upload:${item.id}`;
          const isViewing = workingId === `view:${item.id}`;
          const isDownloading = workingId === `download:${item.id}`;
          const needsUpload = !item.storagePath || ["requested", "rejected", "expired"].includes(item.status);

          return (
            <article
              key={item.id}
              className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                  {item.status === "verified" ? <FileCheck2 size={20} /> : item.storagePath ? <FileUp size={20} /> : <FileText size={20} />}
                </span>
                <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-bold capitalize ${statusStyles[item.status] || statusStyles.requested}`}>
                  {item.status || "requested"}
                </span>
              </div>

              <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">{item.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {item.documentType || "Document"}
                {item.dueDate ? ` · Due ${item.dueDate}` : ""}
              </p>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {statusCopy[item.status] || statusCopy.requested}
              </p>

              {item.notes ? (
                <div className="mt-4 rounded-xl bg-[var(--gv-surface)] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Advisor instruction</p>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{item.notes}</p>
                </div>
              ) : null}

              {item.verificationNote ? (
                <div className={`mt-4 rounded-xl p-3 text-sm ${item.status === "rejected" ? "bg-red-50 text-red-700" : "bg-[var(--gv-surface)] text-slate-600"}`}>
                  <strong>GrowVest note:</strong> {item.verificationNote}
                </div>
              ) : null}

              {item.fileName ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-700">{item.fileName}</p>
                    <p className="text-[10px] text-slate-400">{formatFileSize(item.sizeBytes)}</p>
                  </div>
                  <FileCheck2 size={17} className="shrink-0 text-emerald-600" />
                </div>
              ) : null}

              <div className={`mt-5 grid gap-2 ${item.storagePath ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
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

        {!documents.length ? (
          <div className="grid place-items-center rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white px-6 py-14 text-center shadow-[var(--gv-shadow-card)] md:col-span-2">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <FileCheck2 size={24} />
            </span>
            <h2 className="mt-4 font-heading text-xl font-bold text-[var(--gv-ink)]">No document requests yet</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Your GrowVest Advisor must first create a request. Once requested, the document and its Upload button will appear on this page.
            </p>
          </div>
        ) : null}
      </section>

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
