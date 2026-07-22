import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import MomForm from "@/components/mom/MomForm";
export default function CreateMomPage() { return <div className="grid gap-6"><PageHeader eyebrow="Meeting governance" title="Create MOM" description="Complete the meeting record and publish only client-safe content to the Investor." /><Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading MOM form…</div>}><MomForm /></Suspense></div>; }
