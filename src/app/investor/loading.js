import { GrowVestActivityIndicator } from "@/components/investor/mobile/GrowVestMotionMark";

export default function InvestorLoading() {
  return (
    <div className="grid gap-4">
      <div className="md:hidden">
        <div className="mb-4 flex items-center gap-2.5 px-1 text-[11px] font-semibold text-slate-500">
          <GrowVestActivityIndicator className="h-6 w-6" label="Loading GrowVest Investor App" />
          <span>Preparing this view…</span>
        </div>
        <div className="space-y-3">
          <div className="gv-skeleton h-36 rounded-[22px]" />
          <div className="grid grid-cols-4 gap-2">
            <div className="gv-skeleton h-20 rounded-[18px]" />
            <div className="gv-skeleton h-20 rounded-[18px]" />
            <div className="gv-skeleton h-20 rounded-[18px]" />
            <div className="gv-skeleton h-20 rounded-[18px]" />
          </div>
          <div className="gv-skeleton h-24 rounded-[20px]" />
          <div className="gv-skeleton h-20 rounded-[20px]" />
        </div>
      </div>
      <div className="hidden gap-4 md:grid">
        <div className="gv-skeleton h-28 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-3"><div className="gv-skeleton h-48 rounded-3xl lg:col-span-2" /><div className="gv-skeleton h-48 rounded-3xl" /></div>
      </div>
    </div>
  );
}
