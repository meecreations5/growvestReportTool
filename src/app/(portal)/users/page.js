"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { USER_ROLES } from "@/lib/constants/roles";
import PageHeader from "@/components/ui/PageHeader";
import UsersTable from "@/components/users/UsersTable";

export default function UsersPage() {
  const { profile } = useAuth();
  const canManage = profile?.role === USER_ROLES.SUPER_ADMIN;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Access control"
        title="Users and roles"
        description="Pre-authorise Microsoft staff accounts, assign application roles and control active access. Public registration remains disabled."
        action={canManage ? (
          <Link href="/users/create" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200">
            <Plus size={17} /> Authorise staff user
          </Link>
        ) : null}
      />
      <UsersTable />
    </div>
  );
}
