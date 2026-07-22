import PageHeader from "@/components/ui/PageHeader";
import MeetingsTable from "@/components/meetings/MeetingsTable";

export default function MeetingsPage() {
  return <div className="grid gap-6"><PageHeader eyebrow="Client engagement" title="Meetings" description="Schedule investor and lead meetings, send Brevo email invitations, open WhatsApp messages and create MOMs." /><MeetingsTable /></div>;
}
