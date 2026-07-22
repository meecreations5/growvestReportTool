export default function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        {eyebrow ? <p className="gv-eyebrow">{eyebrow}</p> : null}
        <h2 className="font-heading mt-1 text-xl sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
