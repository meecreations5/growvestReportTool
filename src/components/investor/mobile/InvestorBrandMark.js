"use client";

const SOURCES = {
  icon: {
    dark: "/brand/growvest-icon.svg",
    white: "/brand/growvest-icon.svg"
  },
  wordmark: {
    dark: "/brand/growvest-wordmark-dark.svg",
    white: "/brand/growvest-wordmark-white.svg"
  },
  logo: {
    dark: "/brand/growvest-logo-dark.svg",
    white: "/brand/growvest-logo-white.svg"
  }
};

export default function InvestorBrandMark({
  variant = "wordmark",
  inverse = false,
  className = "h-auto w-[118px]",
  alt = "GrowVest"
}) {
  const group = SOURCES[variant] || SOURCES.wordmark;
  const src = inverse ? group.white : group.dark;

  return <img src={src} alt={alt} className={`gv-official-brand-mark block object-contain ${className}`} />;
}
