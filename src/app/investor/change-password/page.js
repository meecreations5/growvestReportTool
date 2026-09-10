"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  getIdTokenResult,
  linkWithCredential,
  reauthenticateWithCredential,
  setPersistence,
  updatePassword
} from "firebase/auth";
import { CheckCircle2, ChevronRight, Fingerprint, KeyRound, Link2, LockKeyhole, MonitorSmartphone, ShieldCheck, Smartphone, TimerReset } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/client";
import { inputClassName } from "@/components/ui/Field";
import { linkInvestorGoogleAccount } from "@/services/authService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { confirmInvestorPasswordChanged, getInvestorAppData } from "@/services/investorAppService";
import { GrowVestOutline } from "@/components/investor/mobile/InvestorMobilePrimitives";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";
import {
  disablePlatformBiometric,
  enablePlatformBiometric,
  getInvestorSecurityPreferences,
  isPlatformBiometricAvailable,
  markInvestorUnlocked,
  saveInvestorSecurityPreferences,
  setMobileAppPin
} from "@/lib/auth/investorSecurityPreferences";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.6c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.8A6 6 0 0 1 5.9 12c0-.6.1-1.2.3-1.8V7.5H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.5l3.3-2.7Z" />
      <path fill="#EA4335" d="M12 5.9c1.6 0 3 .5 4.1 1.6l3.1-3A10 10 0 0 0 2.9 7.5l3.3 2.7C7 7.7 9.3 5.9 12 5.9Z" />
    </svg>
  );
}

function MobileProvider({ icon, title, linked, helper }) {
  return <div className="flex min-h-[62px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-3.5 py-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${linked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{icon}</span><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-900">{title}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{helper}</p></div>{linked ? <CheckCircle2 size={17} className="shrink-0 text-emerald-600" /> : <span className="text-[9px] font-black uppercase text-slate-400">Not linked</span>}</div>;
}

export default function ChangePasswordPage() {
  const { firebaseUser, profile, refreshProfile, isDemoInvestor } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signInProvider, setSignInProvider] = useState("");
  const [authorisedGoogleEmail, setAuthorisedGoogleEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(Boolean(profile?.mustChangePassword));
  const [securityPreferences, setSecurityPreferences] = useState(null);
  const [appLockSetupOpen, setAppLockSetupOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingAppLock, setSavingAppLock] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [savingBiometric, setSavingBiometric] = useState(false);

  const providers = useMemo(() => firebaseUser?.providerData?.map((item) => item.providerId) || [], [firebaseUser?.providerData]);
  const hasPasswordProvider = providers.includes("password");
  const hasGoogleProvider = providers.includes("google.com");
  const hasPhoneProvider = providers.includes("phone");
  const passwordAuthEmail = profile?.authEmail || firebaseUser?.email || "";

  useEffect(() => {
    if (!firebaseUser?.uid || isDemoInvestor) return;
    setSecurityPreferences(getInvestorSecurityPreferences(firebaseUser.uid));
    isPlatformBiometricAvailable().then(setBiometricAvailable).catch(() => setBiometricAvailable(false));
  }, [firebaseUser?.uid, isDemoInvestor]);

  useEffect(() => {
    let active = true;
    async function loadSecurityDetails() {
      if (!firebaseUser) return;
      try {
        const tokenResult = await getIdTokenResult(firebaseUser);
        if (active) setSignInProvider(tokenResult.signInProvider || "");
        if (profile?.investorId) {
          const payload = await getInvestorAppData("security");
          if (active) setAuthorisedGoogleEmail(payload.investor?.portalGoogleEmail || "");
        }
      } catch (nextError) { console.warn("Unable to load Investor security details", nextError); }
    }
    loadSecurityDetails();
    return () => { active = false; };
  }, [firebaseUser, profile?.investorId]);

  async function handleSubmit(event) {
    event.preventDefault(); setError(""); setMessage("");
    if (newPassword.length < 8) { setError("The new password must contain at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("The new password and confirmation do not match."); return; }
    if (!auth.currentUser) { setError("Your session has expired. Please sign in again."); return; }
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (hasPasswordProvider && signInProvider === "password") {
        if (!currentPassword) throw new Error("Enter your current password.");
        const credential = EmailAuthProvider.credential(passwordAuthEmail, currentPassword);
        await reauthenticateWithCredential(user, credential); await updatePassword(user, newPassword);
      } else if (hasPasswordProvider) await updatePassword(user, newPassword);
      else {
        if (!passwordAuthEmail) throw new Error("GrowVest has not configured a username for this account.");
        await linkWithCredential(user, EmailAuthProvider.credential(passwordAuthEmail, newPassword));
      }
      await confirmInvestorPasswordChanged({ authEmail: passwordAuthEmail, authMethods: Array.from(new Set([...(profile?.authMethods || []), "username_password"])) });
      await refreshProfile(); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setMessage(hasPasswordProvider ? "Your password has been changed successfully." : "Username and password access has been enabled successfully.");
    } catch (passwordError) {
      console.error("Change password error", passwordError);
      const messageByCode = {
        "auth/invalid-credential": "The current password is incorrect.",
        "auth/wrong-password": "The current password is incorrect.",
        "auth/email-already-in-use": "This username identity is already linked to another account. Ask GrowVest to merge the duplicate account.",
        "auth/provider-already-linked": "Username and password access is already linked.",
        "auth/weak-password": "Choose a stronger password.",
        "auth/requires-recent-login": "Sign out and sign in again using Mobile OTP, Google or Username/Password, then retry.",
        "auth/too-many-requests": "Too many unsuccessful attempts. Please wait and try again."
      };
      setError(messageByCode[passwordError?.code] || passwordError?.message || "Unable to change the password. Please try again.");
    } finally { setSubmitting(false); }
  }

  async function handleLinkGoogle() {
    setError(""); setMessage("");
    if (!authorisedGoogleEmail) { setError("GrowVest has not authorised a Google email for this Investor profile."); return; }
    setLinkingGoogle(true);
    try {
      const result = await linkInvestorGoogleAccount(authorisedGoogleEmail);
      await refreshProfile(); setMessage(`Google account ${result.googleEmail} linked successfully. You can now use Google Login.`);
    } catch (nextError) { setError(nextError.message || "Google account could not be linked."); }
    finally { setLinkingGoogle(false); }
  }


  async function handleEnableAppLock(event) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!firebaseUser?.uid) { setError("Your session has expired. Please sign in again."); return; }
    if (!/^\d{4}$|^\d{6}$/.test(pin)) { setError("Choose a 4 or 6-digit App Lock PIN."); return; }
    if (pin !== confirmPin) { setError("The PIN and confirmation do not match."); return; }
    setSavingAppLock(true);
    try {
      const next = await setMobileAppPin(firebaseUser.uid, pin);
      markInvestorUnlocked(firebaseUser.uid);
      setSecurityPreferences(next);
      setPin(""); setConfirmPin(""); setAppLockSetupOpen(false);
      setMessage("App Lock is enabled on this mobile device.");
    } catch (nextError) { setError(nextError?.message || "Unable to enable App Lock."); }
    finally { setSavingAppLock(false); }
  }

  function handleDisableAppLock() {
    if (!firebaseUser?.uid) return;
    const next = saveInvestorSecurityPreferences(firebaseUser.uid, { mobileAppLockEnabled: false });
    setSecurityPreferences(next);
    setMessage("App Lock is turned off on this mobile device. Your PIN remains protected on this device if you enable it again.");
  }

  function handleEnableExistingAppLock() {
    if (!firebaseUser?.uid) return;
    const next = saveInvestorSecurityPreferences(firebaseUser.uid, { mobileAppLockEnabled: true });
    markInvestorUnlocked(firebaseUser.uid);
    setSecurityPreferences(next);
    setMessage("App Lock is enabled on this mobile device.");
  }

  function handleLockTimeout(value) {
    if (!firebaseUser?.uid) return;
    const next = saveInvestorSecurityPreferences(firebaseUser.uid, { mobileLockTimeout: value });
    setSecurityPreferences(next);
  }

  async function handleBiometricToggle() {
    if (!firebaseUser?.uid) return;
    setError(""); setMessage(""); setSavingBiometric(true);
    try {
      if (securityPreferences?.mobileBiometricEnabled) {
        const next = disablePlatformBiometric(firebaseUser.uid);
        setSecurityPreferences(next);
        setMessage("Biometric unlock is turned off on this device. PIN unlock remains available.");
      } else {
        const next = await enablePlatformBiometric(firebaseUser.uid, profile?.fullName || "GrowVest Investor");
        setSecurityPreferences(next);
        setMessage("Biometric unlock is enabled. GrowVest does not receive or store your biometric data.");
      }
    } catch (nextError) { setError(nextError?.message || "Unable to update biometric unlock."); }
    finally { setSavingBiometric(false); }
  }

  async function handleDesktopSessionPreference(enabled) {
    if (!firebaseUser?.uid) return;
    setError(""); setMessage("");
    try {
      await setPersistence(auth, enabled ? browserSessionPersistence : browserLocalPersistence);
      const next = saveInvestorSecurityPreferences(firebaseUser.uid, { desktopRequireSignInOnClose: enabled });
      setSecurityPreferences(next);
      setMessage(enabled ? "This browser will require a full GrowVest sign-in after it is closed." : "This browser may keep you signed in until you sign out or the session expires.");
    } catch (nextError) { setError(nextError?.message || "Unable to update browser sign-in preference."); }
  }

  function handleDesktopInactivity(value) {
    if (!firebaseUser?.uid) return;
    const next = saveInvestorSecurityPreferences(firebaseUser.uid, { desktopInactivityMinutes: Number(value) });
    setSecurityPreferences(next);
    setMessage(Number(value) ? `Desktop inactivity sign-out set to ${value} minutes.` : "Desktop inactivity sign-out is turned off on this browser.");
  }

  const passwordFields = <form onSubmit={handleSubmit} className="grid gap-4">
    {hasPasswordProvider && signInProvider === "password" ? <label className="grid gap-2 text-xs font-black text-slate-700">Current password<input className={inputClassName} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label> : null}
    <label className="grid gap-2 text-xs font-black text-slate-700">New password<input className={inputClassName} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></label>
    <label className="grid gap-2 text-xs font-black text-slate-700">Confirm new password<input className={inputClassName} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
    <button type="submit" disabled={submitting} className="min-h-12 rounded-2xl bg-[var(--gv-blue)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(31,78,216,.18)] disabled:opacity-60">{submitting ? "Updating password…" : hasPasswordProvider ? "Update password" : "Enable password access"}</button>
  </form>;

  if (isDemoInvestor) {
    return <div className="mx-auto max-w-xl py-3 md:py-8"><DemoInvestorCta title="Login & security is not part of the Demo Experience" description="Your guest demo does not create a real GrowVest login. Become part of GrowVest and our team can set up secure access for your own Investor App." /></div>;
  }

  return <>
    <div className="gv-mobile-app-stack md:hidden">
      <section className="gv-mobile-hero-glow relative overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,#07122f_0%,#0f2a73_46%,#1f4ed8_100%)] p-5 text-white shadow-[0_24px_64px_rgba(31,78,216,.2)]"><GrowVestOutline className="absolute -right-9 top-8 w-40 brightness-0 invert" opacity={0.16} /><span className="relative grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-white/10"><ShieldCheck size={22} /></span><p className="relative mt-4 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100/80">Account security</p><h2 className="relative mt-1 font-heading text-2xl font-bold text-white">Protect your GrowVest access</h2><p className="relative mt-1.5 text-xs leading-5 text-white/65">Manage secure sign-in methods without changing your investor profile or portfolio.</p></section>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">{message}</div> : null}
      <section><div className="mb-2.5"><p className="gv-mobile-section-title">Sign-in methods</p><h2 className="mt-1 font-heading text-lg font-bold text-slate-950">Connected securely</h2></div><div className="space-y-2.5"><MobileProvider icon={<KeyRound size={18} />} title="Username / Password" linked={hasPasswordProvider} helper={hasPasswordProvider ? 'Password access enabled' : 'Set a password below'} /><MobileProvider icon={<Smartphone size={18} />} title="Mobile OTP" linked={hasPhoneProvider} helper={hasPhoneProvider ? 'Mobile verification linked' : 'Not configured'} /><MobileProvider icon={<GoogleMark />} title="Google" linked={hasGoogleProvider} helper={hasGoogleProvider ? 'Google Login enabled' : authorisedGoogleEmail || 'Not authorised'} /></div>{!hasGoogleProvider && authorisedGoogleEmail ? <button type="button" onClick={handleLinkGoogle} disabled={linkingGoogle} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-[var(--gv-blue-soft)] px-3 text-xs font-black text-[var(--gv-blue)] disabled:opacity-60"><Link2 size={15} />{linkingGoogle ? "Linking Google…" : "Link authorised Google account"}</button> : null}</section>
      <section className="gv-mobile-app-card p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EAF0FF] text-[#1F4ED8]"><Fingerprint size={20} strokeWidth={1.5} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-heading text-base font-bold text-slate-950">App Lock</p><p className="mt-0.5 text-[10px] leading-4 text-slate-400">PIN with optional device biometrics.</p></div>
              {securityPreferences?.mobilePinHash ? <button type="button" onClick={securityPreferences?.mobileAppLockEnabled ? handleDisableAppLock : handleEnableExistingAppLock} className={`relative h-6 w-11 rounded-full p-0.5 transition ${securityPreferences?.mobileAppLockEnabled ? 'bg-[#1F4ED8]' : 'bg-slate-200'}`} aria-label="Toggle App Lock"><span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition ${securityPreferences?.mobileAppLockEnabled ? 'translate-x-5' : ''}`} /></button> : null}
            </div>
          </div>
        </div>
        {!securityPreferences?.mobilePinHash || appLockSetupOpen ? (
          <form onSubmit={handleEnableAppLock} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
            <label className="grid gap-1.5 text-[10px] font-bold text-slate-600">Create 4 or 6-digit PIN<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0,6))} inputMode="numeric" type="password" autoComplete="off" className="min-h-12 rounded-2xl border border-slate-200 px-4 text-center text-base font-bold tracking-[0.28em] outline-none focus:border-[#1F4ED8]" placeholder="••••" /></label>
            <label className="grid gap-1.5 text-[10px] font-bold text-slate-600">Confirm PIN<input value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0,6))} inputMode="numeric" type="password" autoComplete="off" className="min-h-12 rounded-2xl border border-slate-200 px-4 text-center text-base font-bold tracking-[0.28em] outline-none focus:border-[#1F4ED8]" placeholder="••••" /></label>
            <button type="submit" disabled={savingAppLock} className="min-h-12 rounded-2xl bg-[#1F4ED8] px-4 text-xs font-bold text-white disabled:opacity-60">{savingAppLock ? 'Saving…' : securityPreferences?.mobilePinHash ? 'Change App Lock PIN' : 'Enable App Lock'}</button>
            {securityPreferences?.mobilePinHash ? <button type="button" onClick={() => { setAppLockSetupOpen(false); setPin(''); setConfirmPin(''); }} className="text-xs font-bold text-slate-500">Cancel</button> : null}
          </form>
        ) : (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <label className="grid gap-1.5 text-[10px] font-bold text-slate-600">Require unlock<select value={securityPreferences?.mobileLockTimeout || 'every_time'} onChange={(event) => handleLockTimeout(event.target.value)} className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"><option value="every_time">Every time app returns</option><option value="5">After 5 minutes</option><option value="15">After 15 minutes</option><option value="30">After 30 minutes</option><option value="0">Until I sign out</option></select></label>
            <div className="flex min-h-[54px] items-center gap-3 rounded-2xl bg-[#F4F6F9] px-3.5">
              <Fingerprint size={18} strokeWidth={1.5} className="text-[#1F4ED8]" />
              <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-900">Biometric unlock</p><p className="text-[10px] text-slate-400">Face ID / fingerprint when supported</p></div>
              <button type="button" disabled={!biometricAvailable || savingBiometric} onClick={handleBiometricToggle} className={`rounded-xl px-3 py-2 text-[10px] font-bold ${securityPreferences?.mobileBiometricEnabled ? 'bg-white text-[#C62828]' : 'bg-[#1F4ED8] text-white'} disabled:opacity-50`}>{savingBiometric ? 'Please wait…' : securityPreferences?.mobileBiometricEnabled ? 'Turn off' : biometricAvailable ? 'Enable' : 'Unavailable'}</button>
            </div>
            <button type="button" onClick={() => setAppLockSetupOpen(true)} className="w-full text-center text-xs font-bold text-[#1F4ED8]">Change App Lock PIN</button>
          </div>
        )}
        <p className="mt-3 text-[9px] leading-4 text-slate-400">App Lock is device-specific. Biometric verification is handled by your phone; GrowVest never receives your fingerprint or Face ID data.</p>
      </section>
      <section className="gv-mobile-app-card p-4">
        <button type="button" onClick={() => setPasswordOpen((value) => !value)} className="flex min-h-12 w-full items-center gap-3 text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gv-blue-soft)] text-[var(--gv-blue)]"><LockKeyhole size={19} /></span>
          <span className="min-w-0 flex-1"><span className="block font-heading text-base font-bold text-slate-950">{hasPasswordProvider ? 'Change password' : 'Enable password'}</span><span className="mt-0.5 block text-[10px] text-slate-400">Signed in using {signInProvider || 'current session'}</span></span>
          <ChevronRight size={18} className={`shrink-0 text-slate-300 transition-transform ${passwordOpen ? 'rotate-90' : ''}`} />
        </button>
        {passwordOpen ? <div className="mt-4 border-t border-slate-100 pt-4">{passwordFields}</div> : null}
        {profile?.mustChangePassword ? <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-[10px] font-bold leading-4 text-amber-700">You are using a temporary password. Change it before continuing regular portal use.</p> : null}
      </section>
      <p className="px-3 text-center text-[10px] leading-4 text-slate-400">GrowVest never displays your password. Authentication continues through Firebase secure identity services.</p>
    </div>

    <div className="hidden gap-5 sm:gap-6 md:grid">
      <InvestorPageHeader eyebrow="Account security" title="Login & security" description="Manage your password and connect authorised login methods to one secure Investor identity." />
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}{message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div> : null}
      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={20} /></span><div><h2 className="font-black text-slate-950">Connected login methods</h2><p className="mt-1 text-sm text-slate-500">One Firebase account should hold all enabled methods.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className={`rounded-xl border p-4 text-sm font-bold ${hasPasswordProvider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}><KeyRound size={18} className="mb-2" />Username / Password<br /><span className="text-xs font-medium">{hasPasswordProvider ? "Linked" : "Not linked"}</span></div><div className={`rounded-xl border p-4 text-sm font-bold ${hasPhoneProvider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}>Mobile OTP<br /><span className="text-xs font-medium">{hasPhoneProvider ? "Linked" : "Not linked"}</span></div><div className={`rounded-xl border p-4 text-sm font-bold ${hasGoogleProvider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}><GoogleMark /> <span className="mt-2 block">Google</span><span className="text-xs font-medium">{hasGoogleProvider ? "Linked" : "Not linked"}</span></div></div>{!hasGoogleProvider && authorisedGoogleEmail ? <button type="button" onClick={handleLinkGoogle} disabled={linkingGoogle} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 disabled:opacity-60"><Link2 size={17} />{linkingGoogle ? "Linking Google…" : `Link Google Account (${authorisedGoogleEmail})`}</button> : null}</section>
      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><MonitorSmartphone size={20} /></span><div className="min-w-0 flex-1"><h2 className="font-black text-slate-950">Browser session security</h2><p className="mt-1 text-sm text-slate-500">These settings apply only to this desktop browser or installed desktop app.</p></div></div>
        <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
          <div><p className="text-sm font-bold text-slate-900">Require sign-in after browser closes</p><p className="mt-1 text-xs leading-5 text-slate-500">When enabled, closing the browser or desktop app ends its remembered Firebase session.</p></div>
          <button type="button" onClick={() => handleDesktopSessionPreference(!securityPreferences?.desktopRequireSignInOnClose)} className={`relative h-7 w-12 shrink-0 rounded-full p-0.5 transition ${securityPreferences?.desktopRequireSignInOnClose !== false ? 'bg-[#1F4ED8]' : 'bg-slate-200'}`} aria-label="Toggle sign in after browser closes"><span className={`block h-6 w-6 rounded-full bg-white shadow-sm transition ${securityPreferences?.desktopRequireSignInOnClose !== false ? 'translate-x-5' : ''}`} /></button>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><TimerReset size={19} className="shrink-0 text-[#1F4ED8]" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">Sign out after inactivity</p><p className="mt-1 text-xs text-slate-500">Adds protection on an unattended computer.</p></div><select value={String(securityPreferences?.desktopInactivityMinutes ?? 30)} onChange={(event) => handleDesktopInactivity(event.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hour</option><option value="0">Off</option></select></div>
      </section>
      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6"><h2 className="font-black text-slate-950">{hasPasswordProvider ? "Change password" : "Enable username and password"}</h2><p className="mt-1 text-sm text-slate-500">Signed in using: <strong>{signInProvider || "current session"}</strong>.</p><div className="mt-5">{passwordFields}</div>{profile?.mustChangePassword ? <p className="mt-4 text-xs font-semibold text-amber-700">You are using a temporary password. Change it before continuing regular portal use.</p> : null}</section>
    </div>
  </>;
}
