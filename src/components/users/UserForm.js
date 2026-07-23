"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  PenTool,
  Save,
  ShieldCheck,
  UserCog
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCESS_LEVEL_LABELS, ACCESS_LEVELS, PERMISSION_GROUPS, ROLE_SUMMARIES } from "@/lib/constants/permissions";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { STAFF_ROLE_OPTIONS } from "@/lib/constants/user";
import { staffInvitationSchema, staffUserUpdateSchema } from "@/lib/validation/userSchema";
import { createStaffInvitation, getStaffUser, updateStaffUser } from "@/services/userService";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";

const initialValues = {
  fullName: "",
  email: "",
  role: "advisor",
  designation: "Investment Advisor",
  advisorCode: "",
  mobile: "",
  signatureEnabled: true,
  emailSignatureHtml: "",
  status: "active"
};

const accessTone = {
  [ACCESS_LEVELS.FULL]: "bg-emerald-50 text-emerald-700",
  [ACCESS_LEVELS.MANAGE]: "bg-blue-50 text-blue-700",
  [ACCESS_LEVELS.ASSIGNED]: "bg-cyan-50 text-cyan-700",
  [ACCESS_LEVELS.VIEW]: "bg-violet-50 text-violet-700",
  [ACCESS_LEVELS.OWN]: "bg-amber-50 text-amber-700",
  [ACCESS_LEVELS.NONE]: "bg-slate-100 text-slate-500"
};

function RoleAccessSummary({ role }) {
  const highlights = useMemo(() => PERMISSION_GROUPS
    .flatMap((group) => group.permissions)
    .filter((permission) => permission.access[role] !== ACCESS_LEVELS.NONE)
    .slice(0, 6), [role]);

  return (
    <Card className="p-5" elevated={false}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><UserCog size={19} /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Role impact</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-slate-950">{ROLE_LABELS[role] || role}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{ROLE_SUMMARIES[role]}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {highlights.map((permission) => {
          const access = permission.access[role];
          return (
            <div key={permission.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-700">{permission.label}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${accessTone[access]}`}>{ACCESS_LEVEL_LABELS[access]}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Users cannot change their own role. Advisor permissions remain limited to assigned records.</p>
    </Card>
  );
}

export default function UserForm({ userId = null }) {
  const router = useRouter();
  const { profile } = useAuth();
  const editing = Boolean(userId);
  const [values, setValues] = useState(initialValues);
  const [loadedUser, setLoadedUser] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!editing) return;
    getStaffUser(userId)
      .then((user) => {
        if (!user) throw new Error("User not found");
        setLoadedUser(user);
        setValues({
          fullName: user.fullName || "",
          email: user.email || "",
          role: user.role || "advisor",
          designation: user.designation || "",
          advisorCode: user.advisorCode || "",
          mobile: user.mobile || "",
          signatureEnabled: user.signatureEnabled !== false,
          emailSignatureHtml: user.emailSignatureHtml || "",
          status: user.status || "active"
        });
      })
      .catch((error) => setFormError(error.message || "Unable to load user."))
      .finally(() => setLoading(false));
  }, [editing, userId]);

  const editingSelf = editing && userId === profile?.id;

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const schema = editing ? staffUserUpdateSchema : staffInvitationSchema;
    const payload = editing ? values : { ...values, email: values.email.toLowerCase() };
    const result = schema.safeParse(payload);

    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach((issue) => { fieldErrors[issue.path[0]] = issue.message; });
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editing) await updateStaffUser(userId, result.data, profile);
      else await createStaffInvitation(result.data, profile);
      router.push("/users");
      router.refresh();
    } catch (error) {
      console.error(error);
      setFormError(error.message || "User access could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (profile?.role !== "super_admin") {
    return <Card className="border-amber-200 bg-amber-50 p-6 text-sm font-medium text-amber-800">Only the Super Admin can create or change staff access.</Card>;
  }

  if (loading) return <Card className="p-8 text-sm text-slate-500">Loading staff access…</Card>;

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 pb-24 lg:pb-0">
      {formError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{formError}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <Card className="p-5 sm:p-7">
            <div className="mb-6 flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={21} /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Controlled Microsoft access</p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-slate-950">{editing ? "Staff identity and role" : "Authorise staff account"}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{editing ? "Update staff identity, assigned role and active application access." : "Authorise the exact organisational Microsoft account before the user signs in."}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Full name" required error={errors.fullName}>
                <input className={inputClassName} value={values.fullName} onChange={(event) => update("fullName", event.target.value)} placeholder="Staff member name" />
              </Field>
              <Field label="Microsoft email" required={!editing} error={errors.email} hint={editing ? "The linked Microsoft identity cannot be changed here." : "Enter the exact organisational Microsoft account."}>
                <input className={`${inputClassName} ${editing ? "bg-slate-100 text-slate-500" : ""}`} type="email" value={values.email} disabled={editing} onChange={(event) => update("email", event.target.value)} placeholder="name@growvest.info" />
              </Field>
              <Field label="Application role" required error={errors.role} hint={editingSelf ? "You cannot change your own role." : "Role assignment controls modules and record scope."}>
                <select className={`${inputClassName} ${editingSelf ? "bg-slate-100 text-slate-500" : ""}`} value={values.role} disabled={editingSelf} onChange={(event) => update("role", event.target.value)}>
                  {STAFF_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Designation" required error={errors.designation}>
                <input className={inputClassName} value={values.designation} onChange={(event) => update("designation", event.target.value)} placeholder="Investment Advisor" />
              </Field>
              {values.role === "advisor" ? (
                <Field label="Advisor code" required error={errors.advisorCode} hint="Used for assignment, reporting and audit references.">
                  <input className={inputClassName} value={values.advisorCode} onChange={(event) => update("advisorCode", event.target.value.toUpperCase())} placeholder="GV-ADV-0001" />
                </Field>
              ) : null}
              <Field label="Mobile number" error={errors.mobile}>
                <input className={inputClassName} value={values.mobile} onChange={(event) => update("mobile", event.target.value.replace(/[^0-9+]/g, ""))} placeholder="+91…" />
              </Field>
              {editing ? (
                <Field label="Access status" required error={errors.status} hint={editingSelf ? "You cannot deactivate your own account." : "Inactive users cannot access the application."}>
                  <select className={`${inputClassName} ${editingSelf ? "bg-slate-100 text-slate-500" : ""}`} value={values.status} disabled={editingSelf} onChange={(event) => update("status", event.target.value)}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              ) : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><PenTool size={19} /></span>
                <div>
                  <h2 className="font-heading text-xl font-bold text-slate-950">Individual email signature</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">Configure a responsive GrowVest signature for reports, meetings, MOM and service emails.</p>
                </div>
              </div>
              {editing ? (
                <Link href={`/users/${userId}/signature`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
                  <PenTool size={16} /> Manage signature
                </Link>
              ) : null}
            </div>
            {editing ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</p><p className="mt-1 text-sm font-semibold capitalize text-slate-900">{loadedUser?.emailSignatureMeta?.status?.replaceAll("_", " ") || (loadedUser?.emailSignature ? "Published" : "Not configured")}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Version</p><p className="mt-1 text-sm font-semibold text-slate-900">{loadedUser?.emailSignatureMeta?.version ? `v${loadedUser.emailSignatureMeta.version}` : "—"}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mode</p><p className="mt-1 text-sm font-semibold capitalize text-slate-900">{loadedUser?.emailSignature?.mode?.replaceAll("_", " ") || "Company default"}</p></div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">The signature can be configured after the Microsoft account completes its first sign-in.</p>
            )}
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <RoleAccessSummary role={values.role} />
          <Card className="p-5" elevated={false}>
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><KeyRound size={18} /></span><div><h2 className="font-heading text-lg font-bold text-slate-950">Authentication</h2><p className="mt-1 text-sm leading-6 text-slate-500">Staff authenticate only through their authorised Microsoft organisational account.</p></div></div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"><span className="inline-flex items-center gap-2 text-slate-600"><Mail size={15} /> Identity</span><span className="font-semibold text-slate-900">Microsoft 365</span></div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"><span className="inline-flex items-center gap-2 text-slate-600"><CheckCircle2 size={15} /> Link state</span><span className="font-semibold text-slate-900">{editing ? "Linked" : "Links on first sign-in"}</span></div>
              {loadedUser?.lastLoginAt ? <div className="rounded-lg border border-slate-200 px-3 py-2.5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Last login recorded</p><p className="mt-1 font-semibold text-slate-900">Available in Users & Roles</p></div> : null}
            </div>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-5" elevated={false}>
            <div className="flex items-start gap-3"><LockKeyhole size={19} className="mt-0.5 shrink-0 text-amber-700" /><div><h2 className="font-semibold text-amber-950">Security safeguards</h2><ul className="mt-2 grid gap-2 text-sm leading-6 text-amber-900"><li>At least one active Super Admin must remain.</li><li>You cannot change your own role or deactivate your own account.</li><li>Deactivation preserves historical reports and audit records.</li></ul></div></div>
          </Card>
        </aside>
      </div>

      <div className="hidden flex-wrap justify-end gap-3 lg:flex">
        <Button type="button" variant="secondary" onClick={() => router.push("/users")}>Cancel</Button>
        <Button type="submit" disabled={saving}><Save size={17} /> {saving ? "Saving…" : editing ? "Save access changes" : "Authorise user"}</Button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-[0.8fr_1.2fr] gap-2"><Button type="button" variant="secondary" onClick={() => router.push("/users")}>Cancel</Button><Button type="submit" disabled={saving}><Save size={17} /> {saving ? "Saving…" : editing ? "Save changes" : "Authorise"}</Button></div>
      </div>
    </form>
  );
}
