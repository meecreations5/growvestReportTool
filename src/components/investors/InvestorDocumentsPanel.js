"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  FileClock,
  FilePlus2,
  FileText,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadInvestorDocument,
  requestInvestorDocument,
  subscribeInvestorDocuments,
  updateInvestorDocumentStatus,
  uploadInvestorDocument,
  viewInvestorDocument
} from "@/services/documentService";
import { INVESTOR_REQUIRED_DOCUMENTS, documentChecklist } from "@/lib/investor/profileStatus";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";

const documentTypes = [
  ...INVESTOR_REQUIRED_DOCUMENTS,
  "Portfolio Statement",
  "Income Proof",
  "Insurance Policy",
  "Signed Proposal",
  "Other"
];

const statusStyles = {
  requested: "border-amber-200 bg-amber-50 text-amber-700",
  uploaded: "border-blue-200 bg-blue-50 text-blue-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  expired: "border-slate-200 bg-slate-100 text-slate-600",
  missing: "border-slate-200 bg-white text-slate-500"
};

function formatFileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InvestorDocumentsPanel({ investor }) {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("Portfolio Statement");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);
  const previewAbortRef = useRef(null);

  useEffect(() => {
    if (!investor?.id) return () => {};

    return subscribeInvestorDocuments(
      investor.id,
      (records) => {
        setDocuments(records);
        setError("");
      },
      (nextError) => {
        console.error(nextError);
        setError("Unable to load Investor documents.");
      }
    );
  }, [investor?.id]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview?.url]);

  useEffect(() => () => {
    previewAbortRef.current?.abort();
  }, []);

  const checklist = useMemo(() => documentChecklist(documents), [documents]);

  const counts = useMemo(
    () => ({
      requested: documents.filter((item) => ["requested", "rejected", "expired"].includes(item.status)).length,
      review: documents.filter((item) => item.status === "uploaded").length,
      verified: documents.filter((item) => item.status === "verified").length
    }),
    [documents]
  );

  async function createRequest() {
    setWorkingId("request");
    setError("");
    setNotice("");

    try {
      await requestInvestorDocument(investor, profile, {
        title,
        documentType,
        dueDate,
        notes
      });
      setTitle("");
      setDueDate("");
      setNotes("");
      setNotice("Document request created. It is now visible in the Investor Portal.");
    } catch (nextError) {
      setError(nextError?.message || "The document request could not be created.");
    } finally {
      setWorkingId("");
    }
  }

  async function upload(item, file) {
    if (!file) return;
    const actionKey = `upload:${item.id}`;
    setWorkingId(actionKey);
    setError("");
    setNotice("");

    try {
      await uploadInvestorDocument(item, file, profile);
      setNotice(`${file.name} uploaded successfully on behalf of the Investor.`);
    } catch (nextError) {
      setError(nextError?.message || "The document could not be uploaded.");
    } finally {
      setWorkingId((current) => current === actionKey ? "" : current);
    }
  }

  async function setStatus(item, status) {
    const note = status === "rejected" ? window.prompt("Reason for rejection") || "" : "";
    if (status === "rejected" && !note.trim()) return;

    const actionKey = `status:${item.id}`;
    setWorkingId(actionKey);
    setError("");
    setNotice("");

    try {
      await updateInvestorDocumentStatus(item, profile, status, note);
      setNotice(`Document marked ${status}.`);
    } catch (nextError) {
      setError(nextError?.message || "The document status could not be updated.");
    } finally {
      setWorkingId((current) => current === actionKey ? "" : current);
    }
  }

  async function download(item) {
    const actionKey = `download:${item.id}`;
    setWorkingId(actionKey);
    setError("");
    setNotice("");

    try {
      await downloadInvestorDocument(item);
    } catch (nextError) {
      setError(nextError?.message || "The document could not be downloaded.");
    } finally {
      setWorkingId((current) => current === actionKey ? "" : current);
    }
  }

  async function view(item) {
    const actionKey = `view:${item.id}`;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setWorkingId(actionKey);
    setError("");
    setNotice("");
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
    <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <FilePlus2 size={20} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Access &amp; Documents</p>
            <h2 className="font-heading text-xl font-bold text-[var(--gv-ink)]">Investor document centre</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Create a request for the Investor, or upload a file on their behalf after the request is created.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Requested", counts.requested],
            ["Review", counts.review],
            ["Verified", counts.verified]
          ].map(([label, value]) => (
            <div key={label} className="min-w-[74px] rounded-xl bg-[var(--gv-surface)] px-3 py-2">
              <p className="font-heading text-lg font-bold text-[var(--gv-ink)]">{value}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <p>
          <strong>Upload location:</strong> Staff use this tab under <strong>Investors → Investor Profile → Access &amp; Documents</strong>. Investors use <strong>Investor Portal → Documents</strong> after a request is created.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">Profile document status</p>
            <h3 className="mt-1 font-heading text-lg font-bold text-slate-950">Required KYC &amp; profile documents</h3>
          </div>
          <p className="text-xs font-semibold text-slate-500">{checklist.filter((item) => ["uploaded", "verified"].includes(item.status)).length}/{checklist.length} uploaded</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {checklist.map((item) => (
            <div key={item.documentType} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{item.documentType}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{item.fileName || (item.status === "missing" ? "No file uploaded" : "Request exists")}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold capitalize ${statusStyles[item.status] || statusStyles.missing}`}>{item.status === "missing" ? "Missing" : item.status}</span>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          {notice}
        </p>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Step 1</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-[var(--gv-ink)]">Request a document</h3>
          <p className="mt-1 text-sm text-slate-500">The request and Upload button will immediately appear in the Investor Portal.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Document title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Updated PAN Card"
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Document type</span>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500"
            >
              {documentTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Instructions</span>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional note for the Investor"
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={createRequest}
          disabled={workingId === "request" || !title.trim()}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white transition hover:bg-[var(--gv-blue-strong)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <FilePlus2 size={17} />
          {workingId === "request" ? "Creating request…" : "Create document request"}
        </button>
      </div>

      <div className="mt-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Step 2</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-[var(--gv-ink)]">Upload and verify</h3>
          <p className="mt-1 text-sm text-slate-500">The Investor can upload from their portal, or staff can upload from the request card below.</p>
        </div>

        <div className="mt-4 grid gap-3">
          {documents.map((item) => {
            const isWorking = workingId.endsWith(`:${item.id}`);
            const isUploading = workingId === `upload:${item.id}`;
            const isViewing = workingId === `view:${item.id}`;
            const isDownloading = workingId === `download:${item.id}`;

            return (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                      {item.storagePath ? <FileText size={18} /> : <FileClock size={18} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-heading text-lg font-bold text-[var(--gv-ink)]">{item.title}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusStyles[item.status] || statusStyles.requested}`}>
                          {item.status || "requested"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.documentType || "Document"}
                        {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                      </p>
                      {item.fileName ? (
                        <p className="mt-2 truncate text-xs font-semibold text-slate-700">
                          {item.fileName}{formatFileSize(item.sizeBytes) ? ` · ${formatFileSize(item.sizeBytes)}` : ""}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-amber-700">Waiting for a PDF, JPG or PNG file.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-50">
                      <Upload size={14} />
                      {isUploading ? "Uploading…" : item.storagePath ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        className="hidden"
                        disabled={isWorking}
                        onChange={(event) => {
                          upload(item, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>

                    {item.storagePath ? (
                      <button
                        type="button"
                        onClick={() => view(item)}
                        disabled={isWorking}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Eye size={14} /> {isViewing ? "Opening…" : "View"}
                      </button>
                    ) : null}

                    {item.storagePath ? (
                      <button
                        type="button"
                        onClick={() => download(item)}
                        disabled={isWorking}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Download size={14} /> {isDownloading ? "Downloading…" : "Download"}
                      </button>
                    ) : null}

                    {item.status === "uploaded" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setStatus(item, "verified")}
                          disabled={isWorking}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={14} /> Verify
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(item, "rejected")}
                          disabled={isWorking}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700 disabled:opacity-50"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {item.notes ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    <strong>Instruction:</strong> {item.notes}
                  </p>
                ) : null}

                {item.verificationNote ? (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    <strong>Verification note:</strong> {item.verificationNote}
                  </p>
                ) : null}
              </article>
            );
          })}

          {!documents.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <FileClock size={24} className="mx-auto text-slate-400" />
              <p className="mt-3 font-semibold text-slate-700">No document requests yet</p>
              <p className="mt-1 text-sm text-slate-500">Create the first request using the form above.</p>
            </div>
          ) : null}
        </div>
      </div>

      <DocumentPreviewModal
        preview={preview}
        onClose={closePreview}
        onDownload={() => preview?.documentRecord ? download(preview.documentRecord) : null}
      />
    </section>
  );
}
