import { Suspense } from "react";
import PageHeader from "@/components/ui/PageHeader";
import MeetingForm from "@/components/meetings/MeetingForm";
export default function CreateMeetingPage() { return <div className="grid gap-6"><PageHeader eyebrow="Meeting management" title="Schedule meeting" description="Enter the meeting link manually, notify the investor and Advisor, and attach an .ics calendar invitation." /><Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading meeting form…</div>}><MeetingForm /></Suspense></div>; }
