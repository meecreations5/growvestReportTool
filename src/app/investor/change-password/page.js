"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  getIdTokenResult,
  linkWithCredential,
  reauthenticateWithCredential,
  updatePassword
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { KeyRound, Link2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth, db } from "@/lib/firebase/client";
import { inputClassName } from "@/components/ui/Field";
import { linkInvestorGoogleAccount } from "@/services/authService";
import InvestorPageHeader from "@/components/investor/InvestorPageHeader";

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

export default function ChangePasswordPage() {
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signInProvider, setSignInProvider] = useState("");
  const [authorisedGoogleEmail, setAuthorisedGoogleEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
          const snapshot = await getDoc(doc(db, "investors", profile.investorId));
          if (active && snapshot.exists()) setAuthorisedGoogleEmail(snapshot.data().portalGoogleEmail || "");
        }
      } catch (nextError) {
        console.warn("Unable to load Investor security details", nextError);
      }
    }
    loadSecurityDetails();
    return () => { active = false; };
  }, [firebaseUser, profile?.investorId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 8) {
      setError("The new password must contain at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    if (!auth.currentUser) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (hasPasswordProvider && signInProvider === "password") {
        if (!currentPassword) throw new Error("Enter your current password.");
        const credential = EmailAuthProvider.credential(passwordAuthEmail, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
      } else if (hasPasswordProvider) {
        // Phone/Google sign-in is a recent authentication. Firebase permits a
        // password update without asking for an unrelated email password.
        await updatePassword(user, newPassword);
      } else {
        if (!passwordAuthEmail) throw new Error("GrowVest has not configured a username for this account.");
        await linkWithCredential(user, EmailAuthProvider.credential(passwordAuthEmail, newPassword));
      }

      await updateDoc(doc(db, "users", user.uid), {
        mustChangePassword: false,
        authEmail: passwordAuthEmail,
        authMethods: Array.from(new Set([...(profile?.authMethods || []), "username_password"])),
        passwordChangedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await refreshProfile();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLinkGoogle() {
    setError("");
    setMessage("");
    if (!authorisedGoogleEmail) {
      setError("GrowVest has not authorised a Google email for this Investor profile.");
      return;
    }
    setLinkingGoogle(true);
    try {
      const result = await linkInvestorGoogleAccount(authorisedGoogleEmail);
      await refreshProfile();
      setMessage(`Google account ${result.googleEmail} linked successfully. You can now use Google Login.`);
    } catch (nextError) {
      setError(nextError.message || "Google account could not be linked.");
    } finally {
      setLinkingGoogle(false);
    }
  }

  return (
    <div className="grid gap-5 sm:gap-6">
      <InvestorPageHeader eyebrow="Account security" title="Login & security" description="Manage your password and connect authorised login methods to one secure Investor identity." />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div> : null}

      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck size={20} /></span>
          <div><h2 className="font-black text-slate-950">Connected login methods</h2><p className="mt-1 text-sm text-slate-500">One Firebase account should hold all enabled methods.</p></div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className={`rounded-xl border p-4 text-sm font-bold ${hasPasswordProvider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}><KeyRound size={18} className="mb-2" />Username / Password<br /><span className="text-xs font-medium">{hasPasswordProvider ? "Linked" : "Not linked"}</span></div>
          <div className={`rounded-xl border p-4 text-sm font-bold ${hasPhoneProvider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}>Mobile OTP<br /><span className="text-xs font-medium">{hasPhoneProvider ? "Linked" : "Not linked"}</span></div>
          <div className={`rounded-xl border p-4 text-sm font-bold ${hasGoogleProvider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-500"}`}><GoogleMark /> <span className="mt-2 block">Google</span><span className="text-xs font-medium">{hasGoogleProvider ? "Linked" : "Not linked"}</span></div>
        </div>
        {!hasGoogleProvider && authorisedGoogleEmail ? <button type="button" onClick={handleLinkGoogle} disabled={linkingGoogle} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 disabled:opacity-60"><Link2 size={17} />{linkingGoogle ? "Linking Google…" : `Link Google Account (${authorisedGoogleEmail})`}</button> : null}
      </section>

      <section className="rounded-[var(--gv-radius-lg)] border border-[var(--gv-border)] bg-white p-5 shadow-[var(--gv-shadow-card)] sm:p-6">
        <h2 className="font-black text-slate-950">{hasPasswordProvider ? "Change password" : "Enable username and password"}</h2>
        <p className="mt-1 text-sm text-slate-500">Signed in using: <strong>{signInProvider || "current session"}</strong>.</p>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-5">
          {hasPasswordProvider && signInProvider === "password" ? <label className="grid gap-2 text-sm font-semibold text-slate-700">Current password<input className={inputClassName} type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label> : null}
          <label className="grid gap-2 text-sm font-semibold text-slate-700">New password<input className={inputClassName} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Confirm new password<input className={inputClassName} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
          <button type="submit" disabled={submitting} className="min-h-12 rounded-xl bg-[var(--gv-blue)] px-4 py-3 text-sm font-bold text-white hover:bg-[var(--gv-blue-strong)] disabled:opacity-60">{submitting ? "Updating password…" : hasPasswordProvider ? "Update password" : "Enable password access"}</button>
        </form>
        {profile?.mustChangePassword ? <p className="mt-4 text-xs font-semibold text-amber-700">You are using a temporary password. Change it before continuing regular portal use.</p> : null}
      </section>
    </div>
  );
}
