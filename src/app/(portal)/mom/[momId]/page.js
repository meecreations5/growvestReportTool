import MomDetailClient from "@/components/mom/MomDetailClient";
export default async function MomDetailPage({ params }) { const { momId } = await params; return <MomDetailClient momId={momId} />; }
