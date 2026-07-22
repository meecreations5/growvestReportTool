export default function PageHeader({ eyebrow, title, description, action, breadcrumb }) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="min-w-0">
        {breadcrumb ? <p className="mb-2 text-xs font-semibold text-slate-500">{breadcrumb}</p> : null}
        {eyebrow ? <p className="gv-eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="font-heading text-[1.9rem] leading-[1.08] sm:text-[2.3rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
