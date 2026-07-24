"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  KeyRound,
  LockKeyhole,
  MailCheck,
  Pencil,
  PenTool,
  Search,
  ShieldCheck,
  ShieldQuestion,
  UserCog,
  UserRoundCheck,
  UserRoundPlus,
  UsersRound,
  Save,
  RotateCcw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeInvestors } from "@/services/assessmentService";
import {
  backfillMissingAdvisorCodes,
  cancelStaffInvitation,
  setStaffUserStatus,
  subscribeStaffAccessActivity,
  subscribeStaffInvitations,
  subscribeStaffUsers
} from "@/services/userService";
import { ACCESS_LEVEL_LABELS, ACCESS_LEVEL_OPTIONS, ACCESS_LEVELS, PERMISSION_GROUPS, ROLE_SUMMARIES, normalisePermissionOverrides } from "@/lib/constants/permissions";
import { ROLE_LABELS, USER_ROLES } from "@/lib/constants/roles";
import { hasAdvisorProfile } from "@/lib/utils/advisorProfile";
import { formatDateTime } from "@/lib/utils/date";
import { inputClassName } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import MetricCard from "@/components/ui/MetricCard";
import UserStatusBadge from "./UserStatusBadge";
import { usePermissions } from "@/contexts/PermissionContext";
import { saveRolePermissions, saveUserPermissionOverrides } from "@/services/permissionService";

const TABS = [
  { id: "staff", label: "Staff Access", icon: UsersRound },
  { id: "investors", label: "Investor Access", icon: CircleUserRound },
  { id: "permissions", label: "Permission Matrix", icon: ShieldCheck },
  { id: "activity", label: "Access Activity", icon: Activity }
];

const ACCESS_STYLES = {
  [ACCESS_LEVELS.FULL]: "border-emerald-200 bg-emerald-50 text-emerald-700",
  [ACCESS_LEVELS.MANAGE]: "border-blue-200 bg-blue-50 text-blue-700",
  [ACCESS_LEVELS.ASSIGNED]: "border-cyan-200 bg-cyan-50 text-cyan-700",
  [ACCESS_LEVELS.VIEW]: "border-violet-200 bg-violet-50 text-violet-700",
  [ACCESS_LEVELS.OWN]: "border-amber-200 bg-amber-50 text-amber-700",
  [ACCESS_LEVELS.NONE]: "border-slate-200 bg-slate-50 text-slate-500"
};

function initials(value = "") {
  return String(value || "GV")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function staffAuthLabel(item) {
  if (item.recordState === "invitation") return "Microsoft pending";
  if (item.authMethod === "microsoft") return "Microsoft linked";
  return item.authMethod ? String(item.authMethod).replaceAll("_", " ") : "Microsoft linked";
}

function investorAuthMethods(investor) {
  const methods = investor.portalAuthMethods || investor.authMethods || [];
  if (!Array.isArray(methods) || !methods.length) return investor.portalEnabled ? ["Portal configured"] : [];
  return methods.map((method) => {
    if (method === "username_password") return "Password";
    if (method === "phone") return "Mobile OTP";
    if (method === "google") return "Google";
    return String(method).replaceAll("_", " ");
  });
}

function AccessBadge({ level }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${ACCESS_STYLES[level] || ACCESS_STYLES.none}`}>
      {ACCESS_LEVEL_LABELS[level] || level}
    </span>
  );
}

function ConfirmationDialog({ confirmation, working, onCancel, onConfirm }) {
  if (!confirmation) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="access-confirmation-title" className="w-full rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${confirmation.tone === "danger" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {confirmation.tone === "danger" ? <AlertTriangle size={21} /> : <ShieldCheck size={21} />}
          </span>
          <div className="min-w-0">
            <h2 id="access-confirmation-title" className="font-heading text-xl font-bold text-slate-950">{confirmation.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{confirmation.description}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={working}>Cancel</Button>
          <Button type="button" variant={confirmation.tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={working}>
            {working ? "Updating…" : confirmation.confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

function StaffCard({ item, canManage, canManageSignature, working, onToggle, onCancel }) {
  const invitation = item.recordState === "invitation";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">{initials(item.fullName)}</span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-slate-950">{item.fullName || "Staff user"}</h3>
            <p className="mt-1 truncate text-xs text-slate-500">{item.email}</p>
          </div>
        </div>
        <UserStatusBadge status={item.status} invitationStatus={invitation ? item.status : null} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Role</dt><dd className="mt-1 font-semibold text-slate-800">{ROLE_LABELS[item.role] || item.role}</dd>{hasAdvisorProfile(item) ? <span className="mt-1 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700">Advisor · {item.advisorCode || "Code pending"}</span> : null}</div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Designation</dt><dd className="mt-1 font-semibold text-slate-800">{item.designation || "—"}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Authentication</dt><dd className="mt-1 font-semibold text-slate-800">{staffAuthLabel(item)}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last login</dt><dd className="mt-1 font-semibold text-slate-800">{invitation ? "Not signed in" : formatDateTime(item.lastLoginAt)}</dd></div>
      </dl>

      {canManage || canManageSignature ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {!invitation && canManage ? <Link href={`/users/${item.id}/edit`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Pencil size={16} /> Edit access</Link> : null}
          {!invitation && canManageSignature ? <Link href={`/users/${item.id}/signature`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"><PenTool size={16} /> Signature</Link> : null}
          {!invitation && canManage ? <button type="button" disabled={working} onClick={() => onToggle(item)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold disabled:opacity-60 ${item.status === "active" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{item.status === "active" ? <Ban size={16} /> : <CheckCircle2 size={16} />}{item.status === "active" ? "Deactivate" : "Activate"}</button> : null}
          {invitation && canManage && item.status === "pending" ? <button type="button" disabled={working} onClick={() => onCancel(item)} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"><Ban size={16} /> Cancel authorisation</button> : null}
        </div>
      ) : null}
    </article>
  );
}

function StaffAccessPanel({ users, invitations, profile }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const canManage = profile?.role === USER_ROLES.SUPER_ADMIN;
  const canManageSignature = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN].includes(profile?.role);

  const records = useMemo(() => {
    const linkedEmails = new Set(users.map((item) => String(item.email || "").toLowerCase()));
    const pending = invitations.filter((item) => item.status !== "linked" && !linkedEmails.has(String(item.email || "").toLowerCase()));
    return [...users, ...pending];
  }, [invitations, users]);

  const missingAdvisorCodeCount = useMemo(() => records.filter((item) => hasAdvisorProfile(item) && !String(item.advisorCode || "").trim()).length, [records]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((item) => {
      const matchesSearch = !term || [item.fullName, item.email, item.designation, item.advisorCode, staffAuthLabel(item)].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesRole = role === "all" || item.role === role;
      const normalisedStatus = item.recordState === "invitation" ? item.status : item.status || "active";
      const matchesStatus = status === "all" || normalisedStatus === status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [records, role, search, status]);

  function requestToggle(user) {
    const activating = user.status !== "active";
    setConfirmation({
      type: "toggle",
      item: user,
      tone: activating ? "success" : "danger",
      title: activating ? "Activate staff access?" : "Deactivate staff access?",
      description: activating
        ? `${user.fullName} will be able to sign in and access GrowVest based on the assigned role.`
        : `${user.fullName} will be signed out on the next access check and will no longer be able to use the workspace. Historical records remain unchanged.`,
      confirmLabel: activating ? "Activate access" : "Deactivate access"
    });
  }

  function requestCancel(invitation) {
    setConfirmation({
      type: "cancel",
      item: invitation,
      tone: "danger",
      title: "Cancel staff authorisation?",
      description: `${invitation.email} will not be able to create a GrowVest staff profile using this authorisation.`,
      confirmLabel: "Cancel authorisation"
    });
  }

  async function generateMissingCodes() {
    setWorkingId("advisor-code-backfill");
    setError("");
    setNotice("");
    try {
      const result = await backfillMissingAdvisorCodes(profile);
      setNotice(result.updated
        ? `${result.updated} missing Advisor code${result.updated === 1 ? " was" : "s were"} generated successfully.`
        : "All Advisor-capable staff already have an Advisor code.");
    } catch (nextError) {
      setError(nextError.message || "Missing Advisor codes could not be generated.");
    } finally {
      setWorkingId("");
    }
  }

  async function confirmAction() {
    if (!confirmation) return;
    setWorkingId(confirmation.item.id);
    setError("");
    try {
      if (confirmation.type === "toggle") {
        const nextStatus = confirmation.item.status === "active" ? "inactive" : "active";
        await setStaffUserStatus(confirmation.item, nextStatus, profile);
      } else {
        await cancelStaffInvitation(confirmation.item, profile);
      }
      setConfirmation(null);
    } catch (nextError) {
      setError(nextError.message || "Unable to update staff access.");
      setConfirmation(null);
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="gv-card overflow-hidden">
      {error ? <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {notice ? <div role="status" className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {canManage && missingAdvisorCodeCount > 0 ? (
        <div className="flex flex-col gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-950">{missingAdvisorCodeCount} Advisor-capable staff record{missingAdvisorCodeCount === 1 ? " needs" : "s need"} a code</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">Generate sequential GV-ADV codes for existing Advisors, Admins or Super Admins with Advisor capability.</p>
          </div>
          <button type="button" onClick={generateMissingCodes} disabled={workingId === "advisor-code-backfill"} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60">
            <UserRoundCheck size={17} />{workingId === "advisor-code-backfill" ? "Generating…" : "Generate missing codes"}
          </button>
        </div>
      ) : null}
      <div className="grid gap-3 border-b border-slate-200 p-4 xl:grid-cols-[minmax(280px,1fr)_190px_190px]">
        <label className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, designation or Advisor code" /></label>
        <select className={inputClassName} value={role} onChange={(event) => setRole(event.target.value)}><option value="all">All staff roles</option><option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="advisor">Advisor</option></select>
        <select className={inputClassName} value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All access statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select>
      </div>

      {!filtered.length ? <div className="p-4"><EmptyState icon={UsersRound} title="No staff access records" description="No users or Microsoft authorisations match the selected filters." /></div> : (
        <>
          <div className="grid gap-3 p-4 md:hidden">{filtered.map((item) => <StaffCard key={`${item.recordState}-${item.id}`} item={item} canManage={canManage} canManageSignature={canManageSignature} working={workingId === item.id} onToggle={requestToggle} onCancel={requestCancel} />)}</div>
          <div className="gv-scrollbar hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Authentication</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last Login</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
              <tbody>{filtered.map((item) => {
                const invitation = item.recordState === "invitation";
                return <tr key={`${item.recordState}-${item.id}`} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-xs font-bold text-blue-700">{initials(item.fullName)}</span><div><p className="font-semibold text-slate-950">{item.fullName}</p><p className="mt-1 text-xs text-slate-500">{item.email}</p></div></div></td><td className="px-4 py-4"><p className="font-semibold text-slate-700">{ROLE_LABELS[item.role] || item.role}</p>{hasAdvisorProfile(item) ? <span className="mt-1 inline-flex rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700">Advisor enabled</span> : null}</td><td className="px-4 py-4 text-slate-600"><p>{item.designation || "—"}</p>{item.advisorCode ? <p className="mt-1 text-xs font-semibold tracking-wide text-slate-500">{item.advisorCode}</p> : hasAdvisorProfile(item) ? <p className="mt-1 text-xs text-amber-700">Code pending</p> : null}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"><KeyRound size={13} />{staffAuthLabel(item)}</span></td><td className="px-4 py-4"><UserStatusBadge status={item.status} invitationStatus={invitation ? item.status : null} /></td><td className="px-4 py-4 text-slate-600">{invitation ? "Not signed in" : formatDateTime(item.lastLoginAt)}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{!invitation && canManage ? <Link href={`/users/${item.id}/edit`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Pencil size={15} /> Edit</Link> : null}{!invitation && canManageSignature ? <Link href={`/users/${item.id}/signature`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"><PenTool size={15} /> Signature</Link> : null}{!invitation && canManage ? <button type="button" disabled={workingId === item.id} onClick={() => requestToggle(item)} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold disabled:opacity-60 ${item.status === "active" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{item.status === "active" ? <Ban size={15} /> : <CheckCircle2 size={15} />}{item.status === "active" ? "Deactivate" : "Activate"}</button> : null}{invitation && canManage && item.status === "pending" ? <button type="button" disabled={workingId === item.id} onClick={() => requestCancel(item)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"><Ban size={15} /> Cancel</button> : null}</div></td></tr>;
              })}</tbody>
            </table>
          </div>
        </>
      )}
      <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>Showing {filtered.length} of {records.length} access records</span><span className="inline-flex items-center gap-1.5"><MailCheck size={14} /> Microsoft identity links on first authorised sign-in</span></div>
      <ConfirmationDialog confirmation={confirmation} working={Boolean(workingId)} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />
    </section>
  );
}

function InvestorAccessPanel({ investors, loading, error }) {
  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState("all");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return investors.filter((investor) => {
      const matchesSearch = !term || [investor.fullName, investor.clientCode, investor.email, investor.contactNo, investor.assignedAdvisorName].some((value) => String(value || "").toLowerCase().includes(term));
      const matchesPortal = portal === "all" || (portal === "enabled" ? investor.portalEnabled : !investor.portalEnabled);
      return matchesSearch && matchesPortal;
    });
  }, [investors, portal, search]);

  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading Investor Portal access…</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>;

  return (
    <section className="gv-card overflow-hidden">
      <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(280px,1fr)_210px]">
        <label className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Investor, client code, email or Advisor" /></label>
        <select className={inputClassName} value={portal} onChange={(event) => setPortal(event.target.value)}><option value="all">All portal statuses</option><option value="enabled">Portal enabled</option><option value="disabled">Portal disabled</option></select>
      </div>

      {!filtered.length ? <div className="p-4"><EmptyState icon={CircleUserRound} title="No Investor access records" description="No Investors match the current search and portal filter." /></div> : (
        <>
          <div className="grid gap-3 p-4 md:hidden">{filtered.map((investor) => {
            const methods = investorAuthMethods(investor);
            return <Link key={investor.id} href={`/investors/${investor.id}`} className="rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:bg-blue-50/30"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-50 text-sm font-bold text-cyan-700">{initials(investor.fullName)}</span><div className="min-w-0"><h3 className="truncate font-semibold text-slate-950">{investor.fullName}</h3><p className="mt-1 text-xs text-slate-500">{investor.clientCode}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${investor.portalEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{investor.portalEnabled ? "Enabled" : "Disabled"}</span></div><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Advisor</dt><dd className="mt-1 font-semibold text-slate-800">{investor.assignedAdvisorName || "—"}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last portal update</dt><dd className="mt-1 font-semibold text-slate-800">{formatDateTime(investor.portalEnabledAt || investor.updatedAt)}</dd></div><div className="col-span-2"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Login methods</dt><dd className="mt-2 flex flex-wrap gap-2">{methods.length ? methods.map((method) => <span key={method} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{method}</span>) : <span className="text-sm text-slate-500">Not configured</span>}</dd></div></dl><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Open Investor access <ChevronRight size={16} /></span></Link>;
          })}</div>
          <div className="gv-scrollbar hidden overflow-x-auto md:block"><table className="w-full min-w-[1080px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Investor</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Assigned Advisor</th><th className="px-4 py-3">Portal</th><th className="px-4 py-3">Login Methods</th><th className="px-4 py-3">Last Updated</th><th className="px-5 py-3 text-right">Access</th></tr></thead><tbody>{filtered.map((investor) => { const methods = investorAuthMethods(investor); return <tr key={investor.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-950">{investor.fullName}</p><p className="mt-1 text-xs text-slate-500">{investor.clientCode}</p></td><td className="px-4 py-4"><p className="font-medium text-slate-700">{investor.email || "—"}</p><p className="mt-1 text-xs text-slate-500">{investor.contactNo || "—"}</p></td><td className="px-4 py-4 font-medium text-slate-700">{investor.assignedAdvisorName || "—"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${investor.portalEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{investor.portalEnabled ? "Enabled" : "Disabled"}</span></td><td className="px-4 py-4"><div className="flex max-w-[260px] flex-wrap gap-1.5">{methods.length ? methods.map((method) => <span key={method} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{method}</span>) : <span className="text-slate-500">Not configured</span>}</div></td><td className="px-4 py-4 text-slate-600">{formatDateTime(investor.portalEnabledAt || investor.updatedAt)}</td><td className="px-5 py-4 text-right"><Link href={`/investors/${investor.id}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Open <ChevronRight size={15} /></Link></td></tr>; })}</tbody></table></div>
        </>
      )}
      <div className="border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500">Showing {filtered.length} of {investors.length} Investors</div>
    </section>
  );
}

function PermissionMatrix({ users, profile }) {
  const roles = [USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.ADVISOR, USER_ROLES.INVESTOR];
  const { rolePermissions } = usePermissions();
  const [draftRoles, setDraftRoles] = useState(rolePermissions);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userOverrides, setUserOverrides] = useState({});
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setDraftRoles(rolePermissions), [rolePermissions]);

  const editableRoles = profile?.role === USER_ROLES.SUPER_ADMIN
    ? [USER_ROLES.ADMIN, USER_ROLES.ADVISOR, USER_ROLES.INVESTOR]
    : [USER_ROLES.ADVISOR, USER_ROLES.INVESTOR];

  const configurableUsers = useMemo(() => users.filter((item) => {
    if (item.id === profile?.id) return false;
    if (item.role === USER_ROLES.SUPER_ADMIN) return false;
    return true;
  }), [profile?.id, users]);

  const selectedUser = configurableUsers.find((item) => item.id === selectedUserId) || null;

  useEffect(() => {
    if (!selectedUserId && configurableUsers.length) setSelectedUserId(configurableUsers[0].id);
    if (selectedUserId && !configurableUsers.some((item) => item.id === selectedUserId)) {
      setSelectedUserId(configurableUsers[0]?.id || "");
    }
  }, [configurableUsers, selectedUserId]);

  useEffect(() => {
    setUserOverrides(normalisePermissionOverrides(selectedUser?.permissionOverrides || {}));
    setNotice("");
    setError("");
  }, [selectedUser]);

  function updateRolePermission(role, key, level) {
    if (!editableRoles.includes(role)) return;
    setDraftRoles((current) => ({
      ...current,
      [role]: { ...current[role], [key]: level }
    }));
    setNotice("");
  }

  function updateUserPermission(key, level) {
    setUserOverrides((current) => {
      const next = { ...current };
      if (!level) delete next[key];
      else next[key] = level;
      return next;
    });
    setNotice("");
  }

  async function saveRoles() {
    setWorking("roles");
    setError("");
    setNotice("");
    try {
      await saveRolePermissions(draftRoles, profile);
      setNotice("Role-based permissions saved. Active users receive the updated access immediately.");
    } catch (nextError) {
      setError(nextError.message || "Role permissions could not be saved.");
    } finally {
      setWorking("");
    }
  }

  async function saveUserOverrides() {
    if (!selectedUser) return;
    setWorking("user");
    setError("");
    setNotice("");
    try {
      const saved = await saveUserPermissionOverrides(selectedUser.id, userOverrides, profile, selectedUser);
      setUserOverrides(saved);
      setNotice(`${selectedUser.fullName || selectedUser.email} user-specific permissions saved.`);
    } catch (nextError) {
      setError(nextError.message || "User permissions could not be saved.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="grid gap-5">
      {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {notice ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {roles.map((role) => <article key={role} className="gv-card p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={19} /></span><div><h3 className="font-heading text-lg font-bold text-slate-950">{ROLE_LABELS[role]}</h3><p className="text-xs text-slate-500">{editableRoles.includes(role) ? "Administrator configurable" : "Security locked"}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{ROLE_SUMMARIES[role]}</p></article>)}
      </section>

      <section className="gv-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><LockKeyhole size={19} /></span><div><h2 className="font-heading text-xl font-bold text-slate-950">Role permission matrix</h2><p className="mt-1 text-sm leading-6 text-slate-500">Configure module access by role. Super Admin permissions remain locked. Admins can configure Advisor and Investor roles; Super Admins can also configure the Admin role.</p></div></div>
          <div className="flex shrink-0 gap-2"><Button type="button" variant="secondary" onClick={() => setDraftRoles(rolePermissions)} disabled={Boolean(working)}><RotateCcw size={15} /> Reset</Button><Button type="button" onClick={saveRoles} disabled={Boolean(working)}><Save size={15} /> {working === "roles" ? "Saving..." : "Save roles"}</Button></div>
        </div>
        <div className="gv-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Module</th>{roles.map((role) => <th key={role} className="px-4 py-3">{ROLE_LABELS[role]}</th>)}</tr></thead>
            <tbody>{PERMISSION_GROUPS.flatMap((group) => [
              <tr key={`group-${group.label}`} className="border-t border-slate-200 bg-slate-50/70"><td colSpan={5} className="px-5 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group.label}</td></tr>,
              ...group.permissions.map((permission) => <tr key={permission.key} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-semibold text-slate-950">{permission.label}</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{permission.description}</p></td>{roles.map((role) => <td key={`${permission.key}-${role}`} className="px-4 py-4">{editableRoles.includes(role) ? <select aria-label={`${permission.label} for ${ROLE_LABELS[role]}`} className={`${inputClassName} min-h-10 min-w-36 py-2 text-xs font-semibold`} value={draftRoles?.[role]?.[permission.key] || ACCESS_LEVELS.NONE} onChange={(event) => updateRolePermission(role, permission.key, event.target.value)}>{ACCESS_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>)}</select> : <AccessBadge level={draftRoles?.[role]?.[permission.key] || permission.access[role]} />}</td>)}</tr>)
            ])}</tbody>
          </table>
        </div>
      </section>

      <section className="gv-card overflow-hidden">
        <div className="border-b border-slate-200 p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><UserCog size={19} /></span><div><h2 className="font-heading text-xl font-bold text-slate-950">User-specific permissions</h2><p className="mt-1 text-sm leading-6 text-slate-500">Override selected permissions for an individual staff member. Choose Inherit role to remove an override.</p></div></div></div>
        <div className="grid gap-5 p-5">
          <label className="grid max-w-xl gap-2 text-sm font-semibold text-slate-700"><span>Staff user</span><select className={inputClassName} value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Select a staff user</option>{configurableUsers.map((item) => <option key={item.id} value={item.id}>{item.fullName || item.email} - {ROLE_LABELS[item.role] || item.role}</option>)}</select></label>
          {selectedUser ? <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{PERMISSION_GROUPS.flatMap((group) => group.permissions).map((permission) => {
              const inherited = draftRoles?.[selectedUser.role]?.[permission.key] || ACCESS_LEVELS.NONE;
              return <label key={permission.key} className="grid gap-2 rounded-xl border border-slate-200 p-4"><span className="text-sm font-bold text-slate-950">{permission.label}</span><span className="text-xs leading-5 text-slate-500">Role default: {ACCESS_LEVEL_LABELS[inherited]}</span><select className={`${inputClassName} min-h-10 py-2 text-sm`} value={userOverrides[permission.key] || ""} onChange={(event) => updateUserPermission(permission.key, event.target.value)}><option value="">Inherit role ({ACCESS_LEVEL_LABELS[inherited]})</option>{ACCESS_LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{ACCESS_LEVEL_LABELS[level]}</option>)}</select></label>;
            })}</div>
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setUserOverrides({})} disabled={Boolean(working)}><RotateCcw size={15} /> Clear overrides</Button><Button type="button" onClick={saveUserOverrides} disabled={Boolean(working)}><Save size={15} /> {working === "user" ? "Saving..." : "Save user permissions"}</Button></div>
          </> : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No configurable staff user is available.</p>}
        </div>
      </section>
    </div>
  );
}

function AccessActivity({ activities, loading, error }) {
  if (loading) return <div className="gv-card p-8 text-sm text-slate-500">Loading access activity…</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>;
  if (!activities.length) return <EmptyState icon={Activity} title="No access activity yet" description="Staff authorisations, role updates and access-status changes will appear here." />;

  return (
    <section className="gv-card overflow-hidden">
      <div className="border-b border-slate-200 p-5"><h2 className="font-heading text-xl font-bold text-slate-950">Access audit history</h2><p className="mt-1 text-sm text-slate-500">A chronological record of staff authorisation and access-control changes.</p></div>
      <div className="divide-y divide-slate-100">{activities.map((item) => <article key={item.id} className="flex gap-4 p-5"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Activity size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-slate-950">{item.title || "Access updated"}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{item.description || "A user access record was updated."}</p></div><time className="shrink-0 text-xs font-medium text-slate-400">{formatDateTime(item.createdAt)}</time></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{item.createdByName || "GrowVest Admin"}</span>{item.action ? <span>{String(item.action).replaceAll("_", " ")}</span> : null}</div></div></article>)}</div>
    </section>
  );
}

export default function UsersAccessCentre() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("staff");
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activities, setActivities] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [activityError, setActivityError] = useState("");
  const [investorError, setInvestorError] = useState("");

  useEffect(() => {
    const unsubscribeUsers = subscribeStaffUsers((items) => { setUsers(items); setLoadingUsers(false); }, (error) => { console.error(error); setStaffError("Unable to load staff users."); setLoadingUsers(false); });
    const unsubscribeInvitations = subscribeStaffInvitations((items) => { setInvitations(items); setLoadingInvitations(false); }, (error) => { console.error(error); setStaffError("Unable to load pending Microsoft authorisations."); setLoadingInvitations(false); });
    const unsubscribeActivity = subscribeStaffAccessActivity((items) => { setActivities(items); setLoadingActivities(false); }, (error) => { console.error(error); setActivityError("Unable to load access audit history."); setLoadingActivities(false); });
    return () => { unsubscribeUsers?.(); unsubscribeInvitations?.(); unsubscribeActivity?.(); };
  }, []);

  useEffect(() => {
    if (!profile) return undefined;
    return subscribeInvestors(profile, (items) => { setInvestors(items); setLoadingInvestors(false); }, (error) => { console.error(error); setInvestorError("Unable to load Investor Portal access. Deploy the current Firestore indexes and try again."); setLoadingInvestors(false); });
  }, [profile]);

  const metrics = useMemo(() => ({
    total: users.length,
    active: users.filter((item) => item.status === "active").length,
    pending: invitations.filter((item) => item.status === "pending").length,
    inactive: users.filter((item) => item.status === "inactive").length,
    advisors: users.filter((item) => hasAdvisorProfile(item) && item.status === "active").length,
    investorPortal: investors.filter((item) => item.portalEnabled).length
  }), [invitations, investors, users]);

  if (loadingUsers || loadingInvitations) return <div className="grid gap-4"><div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}</div><div className="h-96 animate-pulse rounded-xl bg-slate-200" /></div>;

  return (
    <div className="grid gap-6">
      {staffError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{staffError}</div> : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <MetricCard label="Staff Users" value={metrics.total} helper="Linked staff profiles" icon={UsersRound} tone="blue" />
        <MetricCard label="Active Access" value={metrics.active} helper="Can currently sign in" icon={UserRoundCheck} tone="green" />
        <MetricCard label="Pending" value={metrics.pending} helper="Microsoft authorisations" icon={Clock3} tone="amber" />
        <MetricCard label="Inactive" value={metrics.inactive} helper="Access currently blocked" icon={Ban} tone="red" />
        <MetricCard label="Active Advisors" value={metrics.advisors} helper="Advisor workspaces" icon={UserCog} tone="cyan" />
        <MetricCard label="Investor Portals" value={metrics.investorPortal} helper="Enabled secure access" icon={ShieldCheck} tone="green" />
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label="Users and access sections">{TABS.map((tab) => { const Icon = tab.icon; const active = tab.id === activeTab; return <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => setActiveTab(tab.id)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${active ? "bg-[var(--gv-blue)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon size={16} />{tab.label}</button>; })}</div>

      {activeTab === "staff" ? <StaffAccessPanel users={users} invitations={invitations} profile={profile} /> : null}
      {activeTab === "investors" ? <InvestorAccessPanel investors={investors} loading={loadingInvestors} error={investorError} /> : null}
      {activeTab === "permissions" ? <PermissionMatrix users={users} profile={profile} /> : null}
      {activeTab === "activity" ? <AccessActivity activities={activities} loading={loadingActivities} error={activityError} /> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="gv-card p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserRoundPlus size={19} /></span><div><h2 className="font-heading text-lg font-bold text-slate-950">Controlled registration</h2><p className="mt-2 text-sm leading-6 text-slate-600">Public staff registration is disabled. A Super Admin must authorise the exact Microsoft organisational email and assign its role before first sign-in.</p></div></div></article>
        <article className="gv-card p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><ShieldQuestion size={19} /></span><div><h2 className="font-heading text-lg font-bold text-slate-950">Record-scoped access</h2><p className="mt-2 text-sm leading-6 text-slate-600">Advisors work with assigned records. Investors can access only their own published reports, meetings, goals, documents and profile information.</p></div></div></article>
      </section>
    </div>
  );
}
