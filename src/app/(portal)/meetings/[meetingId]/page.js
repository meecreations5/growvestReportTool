import MeetingDetailClient from "@/components/meetings/MeetingDetailClient";
export default async function MeetingPage({ params }) { const { meetingId } = await params; return <MeetingDetailClient meetingId={meetingId} />; }
