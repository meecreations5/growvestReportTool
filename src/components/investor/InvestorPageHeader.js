import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function InvestorPageHeader({ eyebrow, title, description, backHref, actions }) {
  return (
    <header className="grid gap-3 sm:flex sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {backHref ? <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--gv-blue)]"><ChevronLeft size={15} /> Back</Link> : null}
        {eyebrow ? <p className="gv-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 font-heading text-[2rem] font-bold leading-tight text-[var(--gv-ink)] sm:text-[2.4rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--gv-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
