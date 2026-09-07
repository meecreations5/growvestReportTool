"use client";

import InvestorBrandMark from "@/components/investor/mobile/InvestorBrandMark";

export default function GrowVestSvgLogo({
  className = "h-auto w-[150px]",
  wordmark = true,
  inverse = false,
  variant
}) {
  const resolvedVariant = variant || (wordmark ? "logo" : "icon");
  return <InvestorBrandMark variant={resolvedVariant} inverse={inverse} className={className} alt="GrowVest" />;
}
