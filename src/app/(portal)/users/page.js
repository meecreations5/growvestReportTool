"use client";

import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLES } from "@/lib/constants/roles";
import PageHeader from "@/components/ui/PageHeader";
import UsersAccessCentre from "@/components/users/UsersAccessCentre";

export default function UsersPage() {
  const { profile } = useAuth();
  const canManage = profile?.role === USER_ROLES.SUPER_ADMIN;

  return (
    <div className="grid gap-6 pb-8">
      <PageHeader
        eyebrow="Identity and access management"
        title="Users, Roles & Permissions"
        description="Authorise staff identities, review Investor Portal access, understand effective permissions and maintain an audit-ready access history. Public self-registration remains disabled."
        action={canManage ? (
          <Link href="/users/create" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--gv-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--gv-blue-strong)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gv-blue-soft)]">
            <Plus size={17} /> Authorise Staff User
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600"><ShieldCheck size={16} /> View-only administration</span>
        )}
      />
      <UsersAccessCentre />
    </div>
  );
}
