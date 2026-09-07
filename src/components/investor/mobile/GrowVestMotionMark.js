"use client";

export default function GrowVestMotionMark({
  className = "h-20 w-20",
  compact = false,
  active = true,
  inverse = false,
  label = "GrowVest is working"
}) {
  return (
    <span
      className={`gv-motion-mark ${compact ? "gv-motion-mark--compact" : ""} ${active ? "is-active" : ""} ${inverse ? "is-inverse" : ""} ${className}`}
      role="status"
      aria-label={label}
    >
      <span className="gv-motion-mark__halo" aria-hidden="true" />
      <img className="gv-motion-mark__outline" src="/brand/growvest-icon-outline.svg" alt="" aria-hidden="true" />
      <img className="gv-motion-mark__fill" src="/brand/growvest-icon.svg" alt="" aria-hidden="true" />
      <span className="gv-motion-mark__sweep" aria-hidden="true" />
    </span>
  );
}

export function GrowVestActivityIndicator({ className = "h-5 w-5", inverse = false, label = "Working" }) {
  return <GrowVestMotionMark className={className} compact inverse={inverse} label={label} />;
}
