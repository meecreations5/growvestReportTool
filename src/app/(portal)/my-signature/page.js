"use client";

import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/ui/PageHeader";
import StaffSignatureEditor from "@/components/users/StaffSignatureEditor";
import Card from "@/components/ui/Card";

export default function MySignaturePage() {
  const { profile } = useAuth();
  if (!profile?.id) return <Card className="p-8 text-sm text-slate-500">Loading your signature settings…</Card>;
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader eyebrow="My communication identity" title="My Email Signature" description="Maintain your personal GrowVest signature, preview it across devices and submit it for approval." breadcrumb="Workspace / My Signature" />
      <StaffSignatureEditor userId={profile.id} />
    </div>
  );
}
