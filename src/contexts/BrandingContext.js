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
    // Brand colours stay configurable, while semantic surface/text tokens remain
    // controlled by the active application theme. Keeping dark/surface/muted as
    // separate brand variables prevents published light-mode branding from
    // overriding dark-mode contrast through inline CSS variables.
    root.style.setProperty("--gv-brand-primary", branding.primaryColor || "#1F4ED8");
    root.style.setProperty("--gv-brand-secondary", branding.secondaryColor || "#20B8CD");
    root.style.setProperty("--gv-brand-dark", branding.darkColor || "#0B0B0F");
    root.style.setProperty("--gv-brand-surface", branding.surfaceColor || "#F4F6F9");
    root.style.setProperty("--gv-brand-muted", branding.mutedColor || "#6B7280");

    root.style.setProperty("--gv-brand-danger", branding.dangerColor || "#E53935");
    root.style.setProperty("--gv-brand-warning", branding.warningColor || "#F5B301");
    document.title = `${branding.companyName || "GrowVest"} Investor & Reporting Tool`;

    let themeMeta = document.querySelector('meta[name="theme-color"][data-dynamic-branding="true"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      themeMeta.dataset.dynamicBranding = "true";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = branding.primaryColor || "#1F4ED8";

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

    const pwaIcon = branding.pwaAppleTouchIconUrl || branding.pwaIcon512Url || branding.pwaIcon192Url || icon;
    if (pwaIcon) {
      let appleIcon = document.querySelector('link[rel="apple-touch-icon"][data-dynamic-branding="true"]');
      if (!appleIcon) {
        appleIcon = document.createElement("link");
        appleIcon.rel = "apple-touch-icon";
        appleIcon.dataset.dynamicBranding = "true";
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = pwaIcon;
    }

    let appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"][data-dynamic-branding="true"]');
    if (!appTitle) {
      appTitle = document.createElement("meta");
      appTitle.name = "apple-mobile-web-app-title";
      appTitle.dataset.dynamicBranding = "true";
      document.head.appendChild(appTitle);
    }
    appTitle.content = `${branding.companyName || "GrowVest"} Investor`;

    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      const version = Number(branding.version || 0);
      manifestLink.href = version ? `/manifest.webmanifest?v=${version}` : "/manifest.webmanifest";
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
