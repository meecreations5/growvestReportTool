export default function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`gv-skeleton rounded-xl ${className}`} />;
}
