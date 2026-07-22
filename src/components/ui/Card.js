export default function Card({ children, className = "", elevated = true, as: Component = "section", ...props }) {
  return (
    <Component
      className={`${elevated ? "gv-card" : "gv-card-flat"} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
