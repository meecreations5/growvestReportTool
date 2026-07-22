import PageHeader from "@/components/ui/PageHeader";
import MomsTable from "@/components/mom/MomsTable";
export default function MomPage() { return <div className="grid gap-6"><PageHeader eyebrow="Meeting governance" title="Minutes of Meeting" description="Record discussion summaries, decisions, action items, client-facing notes and next follow-ups." /><MomsTable /></div>; }
