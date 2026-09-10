"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  getIdTokenResult,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword
} from "firebase/auth";
import { CheckCircle2, ChevronRight, KeyRound, Link2, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/client";
import { inputClassName } from "@/components/ui/Field";
import { linkInvestorGoogleAccount } from "@/services/authService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";
import { confirmInvestorPasswordChanged, getInvestorAppData } from "@/services/investorAppService";
import { GrowVestOutline } from "@/components/investor/mobile/InvestorMobilePrimitives";
import DemoInvestorCta from "@/components/investor/DemoInvestorCta";

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

  const providers = useMemo(() => firebaseUser?.providerData?.map((item) => item.providerId) || [], [firebaseUser?.providerData]);
  const hasPasswordProvider = providers.includes("password");
  const hasGoogleProvider = providers.includes("google.com");
  const hasPhoneProvider = providers.includes("phone");
  const passwordAuthEmail = profile?.authEmail || firebaseUser?.email || "";

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
      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6"><h2 className="font-black text-slate-950">{hasPasswordProvider ? "Change password" : "Enable username and password"}</h2><p className="mt-1 text-sm text-slate-500">Signed in using: <strong>{signInProvider || "current session"}</strong>.</p><div className="mt-5">{passwordFields}</div>{profile?.mustChangePassword ? <p className="mt-4 text-xs font-semibold text-amber-700">You are using a temporary password. Change it before continuing regular portal use.</p> : null}</section>
    </div>
  </>;
}
