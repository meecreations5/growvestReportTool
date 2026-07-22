export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-[var(--gv-radius-lg)] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="max-w-md">
        {Icon ? <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[var(--gv-blue)]"><Icon size={22} /></span> : null}
        <h3 className="font-heading mt-4 text-xl">{title}</h3>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
