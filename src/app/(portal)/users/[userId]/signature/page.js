"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StaffSignatureEditor from "@/components/users/StaffSignatureEditor";

export default function StaffSignaturePage({ params }) {
  const { userId } = use(params);
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <div><Link href={`/users/${userId}/edit`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"><ArrowLeft size={17} /> Back to staff access</Link></div>
      <PageHeader eyebrow="Individual communication identity" title="Email Signature" description="Configure the responsive GrowVest signature used in meetings, MOM, monthly reports and service emails." breadcrumb="Users & Roles / Email Signature" />
      <StaffSignatureEditor userId={userId} />
    </div>
  );
}
