import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function InvestorPageHeader({ eyebrow, title, description, backHref, actions }) {
  return (
    <header className="hidden gap-2.5 md:flex md:items-end md:justify-between md:gap-6">
      <div className="min-w-0">
        {backHref ? <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--gv-blue)]"><ChevronLeft size={15} /> Back</Link> : null}
        {eyebrow ? <p className="gv-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 font-heading text-[1.7rem] font-bold leading-tight text-[var(--gv-ink)] md:text-[2.4rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-5.5 text-[var(--gv-muted)] md:mt-2 md:leading-6">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full shrink-0 flex-wrap gap-2 md:w-auto">{actions}</div> : null}
    </header>
  );
}
