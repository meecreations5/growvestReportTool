import PageHeader from "@/components/ui/PageHeader";
import MomForm from "@/components/mom/MomForm";
export default async function EditMomPage({ params }) { const { momId } = await params; return <div className="grid gap-6"><PageHeader eyebrow="Meeting governance" title="Edit MOM" description="Update decisions, action items, follow-up details and client-facing content." /><MomForm momId={momId} /></div>; }
