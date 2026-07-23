"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Copy,
  Eye,
  History,
  LoaderCircle,
  MailCheck,
  MessageCircle,
  Paintbrush,
  RotateCcw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  UserRound,
  XCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { USER_ROLES } from "@/lib/constants/roles";
import {
  DEFAULT_EMAIL_SIGNATURE,
  EMAIL_SIGNATURE_MODES,
  EMAIL_SIGNATURE_STATUSES,
  EMAIL_SIGNATURE_STATUS_LABELS
} from "@/lib/constants/emailSignature";
import { getSignatureSocialLinks, renderEmailSignatureHtml, renderWhatsAppSignatureText } from "@/lib/utils/emailSignature";
import {
  buildSignatureDraft,
  publishSignature,
  requestSignatureChanges,
  restoreSignatureVersion,
  saveSignatureDraft,
  sendSignatureTestEmail,
  submitSignatureForApproval,
  subscribeSignatureVersions,
  subscribeStaffSignatureUser
} from "@/services/staffSignatureService";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, inputClassName } from "@/components/ui/Field";
import SignatureAssetUploader from "./SignatureAssetUploader";

const TABS = [
  { id: "details", label: "Details", icon: UserRound },
  { id: "design", label: "Design", icon: Paintbrush },
  { id: "visibility", label: "Visibility", icon: Settings2 },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "versions", label: "Versions", icon: History }
];

const VISIBILITY_OPTIONS = [
  ["designation", "Designation"],
  ["brandPositioning", "Brand positioning"],
  ["email", "Email"],
  ["mobile", "Mobile / WhatsApp number"],
  ["website", "Website"],
  ["address", "Office address"],
  ["socialMedia", "Social media profiles"],
  ["companyLogo", "GrowVest logo"],
  ["watermark", "Watermark mark"],
  ["footer", "Footer taglines"]
];

function statusClasses(status) {
  if (status === EMAIL_SIGNATURE_STATUSES.PUBLISHED) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === EMAIL_SIGNATURE_STATUSES.PENDING) return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === EMAIL_SIGNATURE_STATUSES.CHANGES_REQUIRED) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatTimestamp(value) {
  if (!value) return "—";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function PreviewCard({ signature, user, branding, mode }) {
  const html = useMemo(() => renderEmailSignatureHtml({ signature, user, branding, previewMode: mode }), [branding, mode, signature, user]);
  const whatsappText = useMemo(() => renderWhatsAppSignatureText({ signature, user, branding }), [branding, signature, user]);
  const mobile = mode === "mobile";
  const whatsapp = mode === "whatsapp";

  if (whatsapp) {
    return (
      <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-[#efeae2] shadow-sm">
        <div className="flex items-center gap-2 border-b border-emerald-800 bg-emerald-700 px-4 py-3 text-xs font-semibold text-white"><MessageCircle size={15} /> WhatsApp signature preview</div>
        <div className="p-4 sm:p-6">
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-4 py-3 shadow-sm">
            <p className="whitespace-pre-line text-sm leading-6 text-slate-800">Hello Investor,{`

`}Thank you for your time. Please find the requested GrowVest update below.{`

`}{whatsappText}</p>
            <p className="mt-2 text-right text-[10px] font-semibold text-emerald-800">WhatsApp-ready text</p>
          </div>
          <button type="button" onClick={() => navigator.clipboard?.writeText(whatsappText)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-700 bg-white px-3 text-xs font-bold text-emerald-800"><Copy size={14} /> Copy signature text</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${mobile ? "max-w-[390px]" : "max-w-[720px]"}`}>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">Email preview · {mobile ? "Mobile" : "Desktop"}</div>
      <div className="p-4 sm:p-6">
        <p className="text-sm leading-6 text-slate-700">Hello Investor,</p>
        <p className="mt-3 text-sm leading-6 text-slate-700">Thank you for your time. Please find the requested GrowVest update below.</p>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-blue-600" />
    </label>
  );
}

export default function StaffSignatureEditor({ userId }) {
  const { profile } = useAuth();
  const { branding } = useBranding();
  const [user, setUser] = useState(null);
  const [signature, setSignature] = useState(DEFAULT_EMAIL_SIGNATURE);
  const [versions, setVersions] = useState([]);
  const [tab, setTab] = useState("details");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [working, setWorking] = useState("");
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef("");

  const isSelf = profile?.id === userId;
  const isAdmin = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(profile?.role);
  const canEdit = isSelf || isAdmin;
  const canPublish = profile?.role === USER_ROLES.SUPER_ADMIN;
  const meta = user?.emailSignatureMeta || {};
  const status = meta.status || (user?.emailSignature ? EMAIL_SIGNATURE_STATUSES.PUBLISHED : EMAIL_SIGNATURE_STATUSES.DRAFT);

  useEffect(() => {
    hydratedRef.current = false;
    lastSavedRef.current = "";
    setUser(null);
    setVersions([]);
    setError("");
    setSuccess("");
    setLoading(true);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    const unsubscribeUser = subscribeStaffSignatureUser(userId, (record) => {
      if (!record) {
        setError("Staff user was not found.");
        setLoading(false);
        return;
      }
      if (!hydratedRef.current) {
        const next = buildSignatureDraft(record, branding);
        setSignature(next);
        lastSavedRef.current = JSON.stringify(next);
        hydratedRef.current = true;
      }
      setUser(record);
      setLoading(false);
    }, (loadError) => {
      setError(loadError.message || "Signature settings could not be loaded.");
      setLoading(false);
    });
    const unsubscribeVersions = subscribeSignatureVersions(userId, setVersions, () => {});
    return () => { unsubscribeUser(); unsubscribeVersions(); };
  }, [branding, userId]);

  useEffect(() => {
    if (!hydratedRef.current || !canEdit || !user) return undefined;
    const currentHash = JSON.stringify(signature);
    if (currentHash === lastSavedRef.current) return undefined;
    setSaveState("pending");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        await saveSignatureDraft(userId, signature, profile, branding, {
          user,
          meta,
          status: EMAIL_SIGNATURE_STATUSES.DRAFT,
          logActivity: false
        });
        lastSavedRef.current = currentHash;
        setSaveState("saved");
      } catch (saveError) {
        setSaveState("failed");
        setError(saveError.message || "Signature draft could not be autosaved.");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [branding, canEdit, meta, profile, signature, user, userId]);

  function update(field, value) {
    setSignature((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  }

  function updateVisibility(key, value) {
    setSignature((current) => ({
      ...current,
      visibility: { ...current.visibility, [key]: value }
    }));
  }

  function applyBrandingDefaults() {
    setSignature((current) => ({
      ...current,
      brandPositioning: branding.signatureBrandPositioning || branding.brandPositioning || "Your Conscious Wealth Partner",
      website: branding.signatureWebsite || branding.website || "",
      officeAddress: branding.signatureAddress || branding.address || "",
      footerLeftText: branding.signatureFooterLeftText || "Fulfill Your Bucketlist",
      footerRightText: branding.signatureFooterRightText || "Experience the Wealth Every Moment"
    }));
    setSuccess("Published signature branding defaults applied to this draft.");
    setError("");
  }

  async function handleSave() {
    setWorking("save");
    setError("");
    setSuccess("");
    try {
      const saved = await saveSignatureDraft(userId, signature, profile, branding, { user, meta });
      lastSavedRef.current = JSON.stringify(saved);
      setSaveState("saved");
      setSuccess("Signature draft saved.");
    } catch (saveError) {
      setError(saveError.message || "Signature draft could not be saved.");
    } finally {
      setWorking("");
    }
  }

  async function handleSubmitApproval() {
    setWorking("submit");
    setError("");
    setSuccess("");
    try {
      await submitSignatureForApproval(userId, signature, profile, branding, user);
      lastSavedRef.current = JSON.stringify(signature);
      setSuccess("Signature submitted for Super Admin approval.");
    } catch (submitError) {
      setError(submitError.message || "Signature could not be submitted.");
    } finally {
      setWorking("");
    }
  }

  async function handlePublish() {
    setWorking("publish");
    setError("");
    setSuccess("");
    try {
      const version = await publishSignature(userId, signature, profile, branding, user);
      lastSavedRef.current = JSON.stringify(signature);
      setSuccess(`Signature version ${version} published and will be used in outgoing emails.`);
    } catch (publishError) {
      setError(publishError.message || "Signature could not be published.");
    } finally {
      setWorking("");
    }
  }

  async function handleRequestChanges() {
    const note = window.prompt("Describe the changes required for this signature:", meta.reviewNote || "");
    if (note === null) return;
    setWorking("changes");
    try {
      await requestSignatureChanges(userId, note, profile);
      setSuccess("Changes requested.");
    } catch (requestError) {
      setError(requestError.message || "Changes could not be requested.");
    } finally {
      setWorking("");
    }
  }

  async function handleTest() {
    setWorking("test");
    setError("");
    setSuccess("");
    try {
      const saved = await saveSignatureDraft(userId, signature, profile, branding, { user, meta, logActivity: false });
      lastSavedRef.current = JSON.stringify(saved);
      setSaveState("saved");
      await sendSignatureTestEmail(userId, true);
      setSuccess(`Test email sent to ${profile?.email || "your staff email"}.`);
    } catch (testError) {
      setError(testError.message || "Test email could not be sent.");
    } finally {
      setWorking("");
    }
  }

  async function handleRestore(version) {
    if (!window.confirm(`Restore signature version ${version.version} into the current draft?`)) return;
    setWorking(`restore-${version.id}`);
    try {
      await restoreSignatureVersion(userId, version, profile);
      const restored = buildSignatureDraft({ ...user, emailSignatureDraft: version.signature }, branding);
      setSignature(restored);
      lastSavedRef.current = JSON.stringify(restored);
      setSuccess(`Version ${version.version} restored to draft.`);
    } catch (restoreError) {
      setError(restoreError.message || "Version could not be restored.");
    } finally {
      setWorking("");
    }
  }

  if (loading) return <Card className="p-8 text-sm text-slate-500">Loading email signature settings…</Card>;
  if (!user) return <Card className="border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">{error || "Staff user was not found."}</Card>;
  if (!canEdit && !isAdmin) return <Card className="border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800">You can manage only your own email signature.</Card>;

  const saveText = saveState === "saving" ? "Autosaving…" : saveState === "pending" ? "Autosave pending" : saveState === "failed" ? "Autosave failed" : "All changes saved";
  const socialLinks = getSignatureSocialLinks(branding);

  return (
    <div className="grid gap-6 pb-24 lg:pb-0">
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {success ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div> : null}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><MailCheck size={22} /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-bold text-slate-950">{user.fullName} email signature</h1>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(status)}`}>{EMAIL_SIGNATURE_STATUS_LABELS[status] || status}</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">Personal details are configurable while company branding remains inherited from published Branding Settings.</p>
              <p className={`mt-2 inline-flex items-center gap-2 text-xs font-semibold ${saveState === "failed" ? "text-red-600" : "text-slate-500"}`}>
                {saveState === "saving" ? <LoaderCircle size={14} className="animate-spin" /> : saveState === "saved" ? <Check size={14} className="text-emerald-600" /> : <ChevronDown size={14} />}{saveText}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={handleTest} disabled={Boolean(working)}><Send size={16} /> {working === "test" ? "Sending…" : "Send test email"}</Button>
            <Button type="button" variant="secondary" onClick={handleSave} disabled={Boolean(working)}><Save size={16} /> Save draft</Button>
            {canPublish ? <Button type="button" onClick={handlePublish} disabled={Boolean(working)}><BadgeCheck size={16} /> {working === "publish" ? "Publishing…" : "Publish signature"}</Button> : <Button type="button" onClick={handleSubmitApproval} disabled={Boolean(working)}><ShieldCheck size={16} /> {working === "submit" ? "Submitting…" : "Submit for approval"}</Button>}
          </div>
        </div>
        {meta.reviewNote ? <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${status === EMAIL_SIGNATURE_STATUSES.CHANGES_REQUIRED ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}><strong>Review note:</strong> {meta.reviewNote}</div> : null}
      </Card>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        <div className="flex min-w-max gap-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${tab === item.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={16} />{item.label}</button>;
          })}
        </div>
      </div>

      {tab === "details" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-5 sm:p-7">
            <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Personal identity</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Signature details</h2><p className="mt-1 text-sm leading-6 text-slate-500">These values appear in Investor emails and can differ from the internal application role.</p></div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Full name" required hint="Given name uses Emitha styling; surname uses League Spartan."><input className={inputClassName} value={signature.fullName} onChange={(event) => update("fullName", event.target.value)} /></Field>
              <Field label="Display surname" hint="Optional surname shown in bold beside the handwritten name."><input className={inputClassName} value={signature.displaySurname} onChange={(event) => update("displaySurname", event.target.value)} placeholder="Agate" /></Field>
              <Field label="Investor-facing designation" required><input className={inputClassName} value={signature.designation} onChange={(event) => update("designation", event.target.value)} placeholder="Client Experience & Operations Partner" /></Field>
              <Field label="Department"><input className={inputClassName} value={signature.department} onChange={(event) => update("department", event.target.value)} placeholder="Client Experience" /></Field>
              <Field label="Brand positioning"><input className={inputClassName} value={signature.brandPositioning} onChange={(event) => update("brandPositioning", event.target.value)} /></Field>
              <Field label="Official email" required><input className={inputClassName} type="email" value={signature.email} onChange={(event) => update("email", event.target.value)} /></Field>
              <Field label="Mobile / WhatsApp number"><input className={inputClassName} value={signature.mobile} onChange={(event) => update("mobile", event.target.value)} /></Field>
              <Field label="Website"><input className={inputClassName} value={signature.website} onChange={(event) => update("website", event.target.value)} /></Field>
              <div className="md:col-span-2"><Field label="Office address"><textarea className={`${inputClassName} min-h-24`} value={signature.officeAddress} onChange={(event) => update("officeAddress", event.target.value)} /></Field></div>
              <Field label="Left footer tagline"><input className={inputClassName} value={signature.footerLeftText} onChange={(event) => update("footerLeftText", event.target.value)} /></Field>
              <Field label="Right footer tagline"><input className={inputClassName} value={signature.footerRightText} onChange={(event) => update("footerRightText", event.target.value)} /></Field>
            </div>
          </Card>
          <Card className="p-5" elevated={false}>
            <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><ShieldCheck size={18} /></span><div><h2 className="font-heading text-lg font-bold text-slate-950">Inherited branding</h2><p className="mt-1 text-sm leading-6 text-slate-500">These details come from published Branding Settings.</p></div></div></div>
            <Button type="button" variant="secondary" size="sm" className="mt-4 w-full justify-center" onClick={applyBrandingDefaults} disabled={!canEdit}><RotateCcw size={15} /> Apply branding defaults</Button>
            <dl className="mt-5 grid gap-4 text-sm">
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Company</dt><dd className="mt-1 font-semibold text-slate-900">{branding.legalName || branding.companyName}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Brand positioning</dt><dd className="mt-1 text-slate-700">{branding.signatureBrandPositioning || branding.brandPositioning || "Not configured"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Website</dt><dd className="mt-1 break-all text-slate-700">{branding.signatureWebsite || branding.website || "Not configured"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Office address</dt><dd className="mt-1 text-slate-700">{branding.signatureAddress || branding.address || "Not configured"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Signature logo</dt><dd className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">{branding.signatureLogoUrl || branding.emailLogoUrl || branding.primaryLogoUrl ? <img src={branding.signatureLogoUrl || branding.emailLogoUrl || branding.primaryLogoUrl} alt="GrowVest signature logo" className="max-h-12 max-w-full object-contain" /> : "Not configured"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Signature icon logo</dt><dd className="mt-2 flex min-h-20 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-3">{branding.signatureIconUrl || branding.footerLogoUrl || branding.iconLogoUrl ? <img src={branding.signatureIconUrl || branding.footerLogoUrl || branding.iconLogoUrl} alt="GrowVest signature icon" className="max-h-16 max-w-24 object-contain" /> : "Not configured"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Social media</dt><dd className="mt-2 flex flex-wrap gap-2">{socialLinks.length ? socialLinks.map((item) => <span key={item.key} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{item.label}</span>) : <span className="text-slate-500">Not configured</span>}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Brand colours</dt><dd className="mt-2 flex gap-2"><span className="h-7 w-7 rounded-full border border-slate-200" style={{ background: branding.primaryColor }} /><span className="h-7 w-7 rounded-full border border-slate-200" style={{ background: branding.secondaryColor }} /><span className="h-7 w-7 rounded-full border border-slate-200" style={{ background: branding.darkColor }} /></dd></div>
            </dl>
          </Card>
        </div>
      ) : null}

      {tab === "design" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Signature mode</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Choose how the signature is rendered</h2>
            <div className="mt-5 grid gap-3">
              {EMAIL_SIGNATURE_MODES.map((mode) => <label key={mode.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${signature.mode === mode.value ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}><input type="radio" name="signature-mode" value={mode.value} checked={signature.mode === mode.value} onChange={() => update("mode", mode.value)} className="mt-1 accent-blue-600" /><div><p className="text-sm font-semibold text-slate-900">{mode.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{mode.description}</p></div></label>)}
            </div>
          </Card>
          <div className="grid gap-5">
            <SignatureAssetUploader userId={userId} assetType="handwritten-name" label="Handwritten-name artwork" hint="Transparent PNG recommended, approximately 800 × 220 px, maximum 2 MB." value={signature.handwrittenNameUrl} onChange={(value) => update("handwrittenNameUrl", value)} disabled={!canEdit} />
            <SignatureAssetUploader userId={userId} assetType="full-signature" label="Full signature image" hint="Optional exact-design fallback, approximately 1200 × 500 px, maximum 5 MB." value={signature.fullSignatureImageUrl} onChange={(value) => update("fullSignatureImageUrl", value)} disabled={!canEdit} />
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800"><strong>Typography:</strong> typed given names use Emitha with a script fallback, while surnames use League Spartan. Upload handwritten-name artwork when the exact licensed Emitha rendering must be preserved across all email clients.</div>
          </div>
        </div>
      ) : null}

      {tab === "visibility" ? (
        <Card className="p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Visibility controls</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Choose what recipients see</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Toggle checked={signature.enabled !== false} onChange={(value) => update("enabled", value)} label="Use individual signature" disabled={!canEdit} />
            {VISIBILITY_OPTIONS.map(([key, label]) => <Toggle key={key} checked={signature.visibility?.[key] !== false} onChange={(value) => updateVisibility(key, value)} label={label} disabled={!canEdit} />)}
          </div>
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">When the individual signature is disabled or unavailable, outgoing emails use the company default signature from Branding Settings.</div>
        </Card>
      ) : null}

      {tab === "preview" ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Live preview</p><h2 className="mt-1 font-heading text-xl font-bold text-slate-950">Email-client presentation</h2></div><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button type="button" onClick={() => setPreviewMode("desktop")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${previewMode === "desktop" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Desktop</button><button type="button" onClick={() => setPreviewMode("mobile")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${previewMode === "mobile" ? "bg-blue-600 text-white" : "text-slate-600"}`}>Mobile</button><button type="button" onClick={() => setPreviewMode("whatsapp")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${previewMode === "whatsapp" ? "bg-emerald-600 text-white" : "text-slate-600"}`}>WhatsApp</button></div></div>
          <PreviewCard signature={signature} user={user} branding={branding} mode={previewMode} />
        </div>
      ) : null}

      {tab === "versions" ? (
        <Card className="p-5 sm:p-7">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><History size={18} /></span><div><h2 className="font-heading text-xl font-bold text-slate-950">Published versions</h2><p className="mt-1 text-sm leading-6 text-slate-500">Published signatures are retained for audit and can be restored into a new draft.</p></div></div>
          <div className="mt-6 grid gap-3">
            {versions.map((version) => <div key={version.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-950">Version {version.version}</p><p className="mt-1 text-xs text-slate-500">Published {formatTimestamp(version.publishedAt)} by {version.publishedByName || "GrowVest Admin"}</p></div><Button type="button" variant="secondary" size="sm" onClick={() => handleRestore(version)} disabled={Boolean(working)}><RotateCcw size={15} /> {working === `restore-${version.id}` ? "Restoring…" : "Restore to draft"}</Button></div>)}
            {!versions.length ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No published signature versions yet.</div> : null}
          </div>
        </Card>
      ) : null}

      {canPublish && status === EMAIL_SIGNATURE_STATUSES.PENDING ? (
        <Card className="border-amber-200 bg-amber-50 p-5" elevated={false}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-amber-950">Approval required</h2><p className="mt-1 text-sm leading-6 text-amber-800">Review the preview, publish the signature or request corrections.</p></div><div className="flex gap-2"><Button type="button" variant="secondary" onClick={handleRequestChanges} disabled={Boolean(working)}><XCircle size={16} /> Request changes</Button><Button type="button" onClick={handlePublish} disabled={Boolean(working)}><BadgeCheck size={16} /> Publish</Button></div></div>
        </Card>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2"><Button type="button" variant="secondary" onClick={handleTest} disabled={Boolean(working)}><Send size={16} /> Test</Button>{canPublish ? <Button type="button" onClick={handlePublish} disabled={Boolean(working)}><BadgeCheck size={16} /> Publish</Button> : <Button type="button" onClick={handleSubmitApproval} disabled={Boolean(working)}><ShieldCheck size={16} /> Submit</Button>}</div>
      </div>
    </div>
  );
}
