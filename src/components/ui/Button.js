const variants = {
  primary: "border border-transparent bg-[var(--gv-blue)] text-white shadow-sm hover:bg-[var(--gv-blue-strong)] focus-visible:ring-[var(--gv-blue-soft)]",
  secondary: "border border-[var(--gv-border)] bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-100",
  quiet: "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-100",
  danger: "border border-transparent bg-[var(--gv-danger)] text-white hover:bg-red-700 focus-visible:ring-red-100"
};

const sizes = {
  sm: "min-h-9 rounded-[var(--gv-radius-sm)] px-3 py-1.5 text-xs",
  md: "min-h-11 rounded-[var(--gv-radius-md)] px-4 py-2.5 text-sm",
  lg: "min-h-12 rounded-[var(--gv-radius-md)] px-5 py-3 text-sm"
};

export default function Button({ children, className = "", variant = "primary", size = "md", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
