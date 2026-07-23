import Link from "next/link";
import { RefreshCw, ShieldCheck, WifiOff } from "lucide-react";

export const metadata = {
  title: "You are offline | GrowVest Investor"
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--gv-surface)] px-5 py-10">
      <section className="w-full max-w-md rounded-[30px] border border-slate-200 bg-white p-7 text-center shadow-[var(--gv-shadow-card)] sm:p-9">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-950 text-white"><WifiOff size={29} /></span>
        <p className="gv-eyebrow mt-6">Connection unavailable</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-slate-950">Your secure portal is temporarily offline.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Reconnect to the internet to load live portfolio data, reports and notifications. Previously opened static app assets remain available.</p>
        <Link href="/investor/dashboard" className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gv-blue)] px-5 text-sm font-bold text-white"><RefreshCw size={17} /> Try again</Link>
        <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400"><ShieldCheck size={15} /> No financial data is stored in the offline cache.</div>
      </section>
    </main>
  );
}
