"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Smartphone, UserRoundCheck } from "lucide-react";
import { updateInvestorPortalAccess } from "@/services/communicationService";

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

export default function InvestorPortalAccessCard({ investor }) {
  const [username, setUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [enableUsername, setEnableUsername] = useState(true);
  const [enableMobile, setEnableMobile] = useState(false);
  const [enableGoogle, setEnableGoogle] = useState(false);
  const [mobile, setMobile] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setUsername(investor?.portalUsername || "");
    setMobile(investor?.portalMobile || investor?.contactNo || investor?.mobile || "");
    setGoogleEmail(investor?.portalGoogleEmail || investor?.email || "");
    const methods = investor?.portalAuthMethods || [];
    setEnableUsername(methods.length ? methods.includes("username_password") : true);
    setEnableMobile(methods.includes("phone"));
    setEnableGoogle(methods.includes("google"));
  }, [investor]);

  async function saveAccess() {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const result = await updateInvestorPortalAccess(investor.id, {
        action: "enable",
        username,
        temporaryPassword,
        enableUsername,
        enableMobile,
        enableGoogle,
        mobile,
        googleEmail
      });
      const baseNotice = result.created ? "Investor Portal account created successfully." : "Investor Portal access updated successfully.";
      setNotice(result.googleLinkRequired ? `${baseNotice} The Investor must sign in with Username/Password or Mobile OTP and link Google from Login & Security before using Google Login.` : baseNotice);
      setTemporaryPassword("");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  async function disableAccess() {
    if (!window.confirm("Disable Investor Portal access for this investor?")) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await updateInvestorPortalAccess(investor.id, { action: "disable" });
      setNotice("Investor Portal access disabled.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck size={20} /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Investor Portal</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Access management</h2>
            <p className="mt-1 text-xs text-slate-500">Enable any combination of username, mobile OTP and authorised Google login.</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${investor.portalEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{investor.portalEnabled ? "Active" : "Disabled"}</span>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{notice}</p> : null}

      <div className="mt-5 grid gap-4">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" checked={enableUsername} onChange={(event) => setEnableUsername(event.target.checked)} className="h-4 w-4" />
          <KeyRound size={18} className="text-blue-700" />
          <div><p className="text-sm font-bold text-slate-900">Username and password</p><p className="text-xs text-slate-500">Investor signs in using a GrowVest username.</p></div>
        </label>
        {enableUsername ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="text-xs font-bold text-slate-500">Username</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="arjun.mehta" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
            <label><span className="text-xs font-bold text-slate-500">Temporary / reset password</span><input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder={investor.portalUid ? "Leave blank to keep current" : "Minimum 6 characters"} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label>
          </div>
        ) : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" checked={enableMobile} onChange={(event) => setEnableMobile(event.target.checked)} className="h-4 w-4" />
          <Smartphone size={18} className="text-cyan-700" />
          <div><p className="text-sm font-bold text-slate-900">Mobile OTP</p><p className="text-xs text-slate-500">Uses the Investor&apos;s registered mobile number.</p></div>
        </label>
        {enableMobile ? <label><span className="text-xs font-bold text-slate-500">Registered mobile number</span><input value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="+919876543210" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label> : null}

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input type="checkbox" checked={enableGoogle} onChange={(event) => setEnableGoogle(event.target.checked)} className="h-4 w-4" />
          <GoogleMark />
          <div><p className="text-sm font-bold text-slate-900">Google login</p><p className="text-xs text-slate-500">Authorise one Google or Google Workspace email for this Investor.</p></div>
        </label>
        {enableGoogle ? <label><span className="text-xs font-bold text-slate-500">Authorised Google email</span><input type="email" value={googleEmail} onChange={(event) => setGoogleEmail(event.target.value)} placeholder="investor@gmail.com" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500" /></label> : null}
        {enableGoogle && investor.portalUid ? <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold leading-5 text-blue-800">Google is authorised for this Investor. To keep one Firebase UID, the Investor must first sign in with Username/Password or Mobile OTP and select <strong>Link Google Account</strong> under Login &amp; Security.</p> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={saveAccess} disabled={working} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><UserRoundCheck size={17} />{working ? "Updating…" : investor.portalEnabled ? "Update Portal Access" : "Enable Portal Access"}</button>
        {investor.portalEnabled ? <button type="button" onClick={disableAccess} disabled={working} className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-60">Disable Access</button> : null}
      </div>
    </section>
  );
}
