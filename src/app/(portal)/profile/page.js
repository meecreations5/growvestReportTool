"use client";

import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/constants/roles";
import ProfilePhotoUploader from "@/components/profile/ProfilePhotoUploader";
import PageHeader from "@/components/ui/PageHeader";

function Detail({ label, value }) {
  return <div className="rounded-2xl bg-[var(--gv-surface)] p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1.5 break-words text-sm font-semibold text-slate-800">{value || "—"}</p></div>;
}

export default function StaffProfilePage() {
  const { profile } = useAuth();
  return (
    <div className="gv-page-stack">
      <PageHeader eyebrow="Account" title="My profile" description="Manage the profile image shown across the GrowVest workspace, signatures and Advisor-facing experiences." />
      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-6 shadow-[var(--gv-shadow-card)]">
          <ProfilePhotoUploader />
          <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><ShieldCheck size={18} className="mb-2" />Your image is visible only inside authenticated GrowVest experiences and approved Advisor communications.</div>
        </article>
        <article className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-6 shadow-[var(--gv-shadow-card)]">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]"><UserRound size={20} /></span><div><p className="gv-eyebrow">Profile details</p><h2 className="font-heading text-xl font-bold">Workspace identity</h2></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Full name" value={profile?.fullName} />
            <Detail label="Role" value={ROLE_LABELS[profile?.role] || profile?.role} />
            <Detail label="Email" value={profile?.email} />
            <Detail label="Mobile" value={profile?.mobile} />
            <Detail label="Designation" value={profile?.designation} />
            <Detail label="Advisor code" value={profile?.advisorCode} />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <a href={`mailto:${profile?.email || ""}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700"><Mail size={16} /> Email</a>
            <a href={profile?.mobile ? `tel:${profile.mobile}` : "#"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700"><Phone size={16} /> Call</a>
          </div>
        </article>
      </section>
    </div>
  );
}
