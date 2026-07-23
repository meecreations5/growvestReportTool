"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_SYSTEM_SETTINGS, normaliseBranding } from "@/services/settingsService";

const BrandingContext = createContext(null);

function mergeBranding(value = {}) {
  return normaliseBranding({
    ...DEFAULT_SYSTEM_SETTINGS.branding,
    ...value
  });
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(() => mergeBranding());
  const [loading, setLoading] = useState(true);

  useEffect(() => onSnapshot(
    doc(db, "publicSettings", "branding"),
    (snapshot) => {
      setBranding(mergeBranding(snapshot.exists() ? snapshot.data() : {}));
      setLoading(false);
    },
    (error) => {
      console.warn("Unable to load public branding settings", error);
      setBranding(mergeBranding());
      setLoading(false);
    }
  ), []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--gv-blue", branding.primaryColor || "#1F4ED8");
    root.style.setProperty("--gv-blue-strong", branding.primaryColor || "#1F4ED8");
    root.style.setProperty("--gv-cyan", branding.secondaryColor || "#20B8CD");
    root.style.setProperty("--gv-ink", branding.darkColor || "#0B0B0F");
    root.style.setProperty("--gv-danger", branding.dangerColor || "#E53935");
    root.style.setProperty("--gv-warning", branding.warningColor || "#F5B301");
    root.style.setProperty("--gv-surface", branding.surfaceColor || "#F4F6F9");
    root.style.setProperty("--gv-muted", branding.mutedColor || "#6B7280");
    document.title = `${branding.companyName || "GrowVest"} Investor & Reporting Tool`;

    const icon = branding.iconLogoUrl;
    if (icon) {
      let link = document.querySelector('link[rel="icon"][data-dynamic-branding="true"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.dataset.dynamicBranding = "true";
        document.head.appendChild(link);
      }
      link.href = icon;
    }
  }, [branding]);

  const value = useMemo(() => ({ branding, loading }), [branding, loading]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error("useBranding must be used inside BrandingProvider");
  return context;
}
