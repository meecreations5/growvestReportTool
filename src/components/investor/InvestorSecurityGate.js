"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import InvestorBrandMark from "@/components/investor/mobile/InvestorBrandMark";
import {
  getInvestorSecurityPreferences,
  isInvestorMobileDevice,
  markInvestorBackgrounded,
  markInvestorUnlocked,
  resetMobileAppLock,
  shouldLockInvestorMobileApp,
  verifyMobileAppPin,
  verifyPlatformBiometric
} from "@/lib/auth/investorSecurityPreferences";

export default function InvestorSecurityGate({ children }) {
  const router = useRouter();
  const { firebaseUser, profile, isDemoInvestor, logout } = useAuth();
  const uid = firebaseUser?.uid || "";
  const [mobile, setMobile] = useState(false);
  const [locked, setLocked] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checkingBiometric, setCheckingBiometric] = useState(false);
  const inactivityTimer = useRef(null);

  const refreshLockState = useCallback(() => {
    if (!uid || isDemoInvestor || !isInvestorMobileDevice()) {
      setLocked(false);
      return;
    }
    const next = getInvestorSecurityPreferences(uid);
    setPreferences(next);
    setLocked(shouldLockInvestorMobileApp(uid, next));
  }, [isDemoInvestor, uid]);

  useEffect(() => {
    setMobile(isInvestorMobileDevice());
    refreshLockState();
    const onResize = () => { setMobile(isInvestorMobileDevice()); refreshLockState(); };
    const onPreferences = (event) => {
      if (event?.detail?.uid && event.detail.uid !== uid) return;
      refreshLockState();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("growvest-security-preferences-changed", onPreferences);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("growvest-security-preferences-changed", onPreferences);
    };
  }, [refreshLockState, uid]);

  useEffect(() => {
    if (!uid || isDemoInvestor || !mobile) return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        markInvestorBackgrounded(uid);
        return;
      }
      refreshLockState();
    };
    const handlePageHide = () => markInvestorBackgrounded(uid);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isDemoInvestor, mobile, refreshLockState, uid]);

  useEffect(() => {
    if (!uid || isDemoInvestor || mobile || locked) return undefined;
    const next = getInvestorSecurityPreferences(uid);
    const timeoutMinutes = Math.max(0, Number(next.desktopInactivityMinutes || 0));
    if (!timeoutMinutes) return undefined;

    const resetTimer = () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(async () => {
        await logout();
        router.replace("/investor-login?reason=inactive");
      }, timeoutMinutes * 60 * 1000);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (inactivityTimer.current) window.clearTimeout(inactivityTimer.current);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [isDemoInvestor, locked, logout, mobile, router, uid]);

  async function unlockWithPin(event) {
    event.preventDefault();
    setError("");
    const verified = await verifyMobileAppPin(uid, pin);
    if (!verified) {
      setError("That PIN is incorrect. Try again or sign in again to reset App Lock.");
      return;
    }
    markInvestorUnlocked(uid);
    setPin("");
    setLocked(false);
  }

  async function unlockWithBiometric() {
    setError("");
    setCheckingBiometric(true);
    try {
      const verified = await verifyPlatformBiometric(uid);
      if (!verified) setError("Biometric unlock was not completed. Use your PIN instead.");
      else {
        markInvestorUnlocked(uid);
        setLocked(false);
      }
    } finally { setCheckingBiometric(false); }
  }

  async function resetAndSignIn() {
    resetMobileAppLock(uid);
    await logout();
    router.replace("/investor-login?reason=app-lock-reset");
  }

  if (!locked || isDemoInvestor || !mobile) return children;

  return (
    <main className="min-h-[100dvh] bg-[#1F4ED8] px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm flex-col justify-between">
        <div>
          <InvestorBrandMark variant="logo" inverse className="h-auto w-[138px] brightness-0 invert" />
          <div className="mt-12 grid h-14 w-14 place-items-center rounded-[20px] border border-white/15 bg-white/10"><LockKeyhole size={25} strokeWidth={1.5} /></div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100">App Lock</p>
          <h1 className="mt-2 font-heading text-[2.05rem] font-bold leading-[1.02] text-white">Welcome back, {profile?.fullName?.split(" ")?.[0] || "Investor"}.</h1>
          <p className="mt-3 text-sm leading-6 text-blue-100">Unlock GrowVest to continue viewing your portfolio and Bucket List.</p>
        </div>

        <div className="rounded-[28px] bg-white p-5 text-[#0B0B0F] shadow-[0_24px_70px_rgba(11,11,15,.22)]">
          {preferences?.mobileBiometricEnabled ? (
            <button type="button" onClick={unlockWithBiometric} disabled={checkingBiometric} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1F4ED8] px-4 text-sm font-bold text-white disabled:opacity-60">
              <Fingerprint size={20} strokeWidth={1.5} /> {checkingBiometric ? "Checking device…" : "Unlock with biometrics"}
            </button>
          ) : null}
          <div className={preferences?.mobileBiometricEnabled ? "mt-4 border-t border-slate-100 pt-4" : ""}>
            <form onSubmit={unlockWithPin}>
              <label className="text-xs font-bold text-slate-700">Enter App Lock PIN</label>
              <div className="relative mt-2">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={1.5} />
                <input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" type="password" className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-center text-lg font-bold tracking-[0.35em] outline-none focus:border-[#1F4ED8] focus:ring-4 focus:ring-blue-100" placeholder="••••" />
              </div>
              {error ? <p className="mt-2 text-xs font-semibold leading-5 text-[#C62828]">{error}</p> : null}
              <button type="submit" disabled={!/^\d{4}$|^\d{6}$/.test(pin)} className="mt-3 min-h-12 w-full rounded-2xl border border-slate-200 bg-[#F4F6F9] px-4 text-sm font-bold text-[#0B0B0F] disabled:opacity-50">Unlock with PIN</button>
            </form>
          </div>
          <button type="button" onClick={resetAndSignIn} className="mt-4 w-full text-center text-xs font-bold text-[#1F4ED8]">Forgot PIN? Sign in again</button>
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-blue-50 p-3 text-[10px] leading-4 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#1F4ED8]" /> Your App Lock PIN is stored only as a protected one-way hash on this device. GrowVest never stores fingerprint or Face ID data.</p>
        </div>
      </div>
    </main>
  );
}
