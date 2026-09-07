"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "growvest-investor-financial-privacy";
const InvestorPrivacyContext = createContext({
  privacyMode: false,
  setPrivacyMode: () => {},
  togglePrivacyMode: () => {}
});

function applyPrivacy(hidden) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.gvPrivacy = hidden ? "hidden" : "visible";
}

export function InvestorPrivacyProvider({ children }) {
  const [privacyMode, setPrivacyModeState] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "hidden";
    setPrivacyModeState(stored);
    applyPrivacy(stored);
  }, []);

  const setPrivacyMode = useCallback((next) => {
    const hidden = Boolean(next);
    setPrivacyModeState(hidden);
    window.localStorage.setItem(STORAGE_KEY, hidden ? "hidden" : "visible");
    applyPrivacy(hidden);
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyModeState((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, next ? "hidden" : "visible");
      applyPrivacy(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ privacyMode, setPrivacyMode, togglePrivacyMode }), [privacyMode, setPrivacyMode, togglePrivacyMode]);
  return <InvestorPrivacyContext.Provider value={value}>{children}</InvestorPrivacyContext.Provider>;
}

export function useInvestorPrivacy() {
  return useContext(InvestorPrivacyContext);
}
