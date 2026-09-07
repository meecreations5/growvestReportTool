import InvestorAppSplash from "@/components/investor/mobile/InvestorAppSplash";

export default function AuthLoadingScreen({ label = "Loading GrowVest workspace…", variant = "workspace" }) {
  if (variant === "investor") {
    return <InvestorAppSplash label={label} />;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        {label}
      </div>
    </div>
  );
}
