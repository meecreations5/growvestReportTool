import PageHeader from "@/components/ui/PageHeader";
import MeetingForm from "@/components/meetings/MeetingForm";
export default async function EditMeetingPage({ params }) { const { meetingId } = await params; return <div className="grid gap-6"><PageHeader eyebrow="Meeting management" title="Edit or reschedule meeting" description="Changes to the schedule trigger updated email and in-app notifications." /><MeetingForm meetingId={meetingId} /></div>; }
