"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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

export default function UserForm({ userId = null }) {
  const router = useRouter();
  const { profile } = useAuth();
  const editing = Boolean(userId);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!editing) return;
    getStaffUser(userId)
      .then((user) => {
        if (!user) throw new Error("User not found");
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

  if (loading) return <Card className="p-8 text-sm text-slate-500">Loading user…</Card>;

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {formError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{formError}</div> : null}

      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><ShieldCheck size={21} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Controlled Microsoft access</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{editing ? "Update staff user" : "Authorise staff account"}</h2>
            <p className="mt-1 text-sm text-slate-600">{editing ? "Update application role and access status." : "The user profile is linked automatically on the first Microsoft sign-in."}</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Full name" required error={errors.fullName}>
            <input className={inputClassName} value={values.fullName} onChange={(event) => update("fullName", event.target.value)} placeholder="Staff member name" />
          </Field>
          <Field label="Microsoft email" required={!editing} error={errors.email} hint={editing ? "Email is linked to the Microsoft identity and cannot be changed here." : "Enter the exact organisational Microsoft account."}>
            <input className={`${inputClassName} ${editing ? "bg-slate-100 text-slate-500" : ""}`} type="email" value={values.email} disabled={editing} onChange={(event) => update("email", event.target.value)} placeholder="name@growvest.info" />
          </Field>
          <Field label="Application role" required error={errors.role}>
            <select className={inputClassName} value={values.role} onChange={(event) => update("role", event.target.value)}>
              {STAFF_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Designation" required error={errors.designation}>
            <input className={inputClassName} value={values.designation} onChange={(event) => update("designation", event.target.value)} placeholder="Investment Advisor" />
          </Field>
          {values.role === "advisor" ? (
            <Field label="Advisor code" required error={errors.advisorCode}>
              <input className={inputClassName} value={values.advisorCode} onChange={(event) => update("advisorCode", event.target.value.toUpperCase())} placeholder="GV-ADV-0001" />
            </Field>
          ) : null}
          <Field label="Mobile number" error={errors.mobile}>
            <input className={inputClassName} value={values.mobile} onChange={(event) => update("mobile", event.target.value.replace(/[^0-9+]/g, ""))} placeholder="+91…" />
          </Field>
          {values.role === "advisor" ? <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 md:col-span-2"><input type="checkbox" checked={values.signatureEnabled !== false} onChange={(event) => update("signatureEnabled", event.target.checked)} className="mt-1 h-4 w-4" /><div><p className="text-sm font-bold text-slate-900">Use Advisor signature in emails</p><p className="mt-1 text-xs text-slate-500">Meeting, MOM and monthly-report emails will use this signature before the company footer.</p></div></label> : null}
          {values.role === "advisor" ? <Field label="Advisor email signature" error={errors.emailSignatureHtml} hint="Simple HTML or plain text. Leave blank to use the company default signature."><textarea className={`${inputClassName} min-h-32`} value={values.emailSignatureHtml} onChange={(event) => update("emailSignatureHtml", event.target.value)} placeholder="Regards,&#10;Priya Sharma&#10;Relationship Manager" /></Field> : null}
          {editing ? (
            <Field label="Access status" required error={errors.status}>
              <select className={inputClassName} value={values.status} onChange={(event) => update("status", event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          ) : null}
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push("/users")}>Cancel</Button>
        <Button type="submit" disabled={saving}><Save size={17} /> {saving ? "Saving…" : editing ? "Save changes" : "Authorise user"}</Button>
      </div>
    </form>
  );
}
