"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_SYSTEM_SETTINGS } from "@/services/settingsService";

const BrandingContext = createContext(null);

function mergeBranding(value = {}) {
  return {
    ...DEFAULT_SYSTEM_SETTINGS.branding,
    ...value,
    iconLogoUrl: value.iconLogoUrl || value.logoUrl || "",
    primaryLogoUrl: value.primaryLogoUrl || value.logoUrl || "",
    whiteLogoUrl: value.whiteLogoUrl || "",
    emailLogoUrl: value.emailLogoUrl || value.primaryLogoUrl || value.logoUrl || "",
    watermarkUrl: value.watermarkUrl || ""
  };
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
    document.documentElement.style.setProperty("--gv-blue", branding.primaryColor || "#1f4ed8");
    document.documentElement.style.setProperty("--gv-cyan", branding.secondaryColor || "#18b9d3");
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
