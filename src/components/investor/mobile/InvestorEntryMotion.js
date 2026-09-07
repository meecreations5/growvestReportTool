"use client";

import { useEffect, useState } from "react";
import InvestorAppSplash from "@/components/investor/mobile/InvestorAppSplash";

const SESSION_KEY = "gv-investor-entry-motion-v3";

export default function InvestorEntryMotion() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    if (window.sessionStorage.getItem(SESSION_KEY) === "shown") return;

    window.sessionStorage.setItem(SESSION_KEY, "shown");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setVisible(true);

    const leaveAt = window.setTimeout(() => setLeaving(true), reduced ? 180 : 1080);
    const removeAt = window.setTimeout(() => setVisible(false), reduced ? 340 : 1380);
    return () => {
      window.clearTimeout(leaveAt);
      window.clearTimeout(removeAt);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`gv-investor-entry-motion ${leaving ? "is-leaving" : ""}`} aria-hidden={leaving ? "true" : undefined}>
      <InvestorAppSplash label="Preparing your investor app…" entry />
    </div>
  );
}
