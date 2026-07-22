export function Field({ label, required, error, hint, children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="grid gap-2 text-sm font-semibold text-slate-700">
      <span>
        {label} {required ? <span className="text-[var(--gv-danger)]" aria-hidden="true">*</span> : null}
      </span>
      {children}
      {error ? <span role="alert" className="text-xs font-medium text-[var(--gv-danger)]">{error}</span> : null}
      {!error && hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  "min-h-12 w-full rounded-[var(--gv-radius-md)] border border-[var(--gv-border)] bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[var(--gv-blue)] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
