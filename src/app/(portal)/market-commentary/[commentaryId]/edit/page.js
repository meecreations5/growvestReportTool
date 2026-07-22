import MarketCommentaryEditor from "@/components/market-commentary/MarketCommentaryEditor";

export default async function EditMarketCommentaryPage({ params }) {
  const { commentaryId } = await params;
  return <MarketCommentaryEditor commentaryId={commentaryId} />;
}
