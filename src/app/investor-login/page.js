"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  UserRound
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createInvestorRecaptcha,
  sendInvestorOtp,
  signInInvestorWithGooglePopup,
  signInInvestorWithUsername,
  verifyInvestorOtp
} from "@/services/authService";
import { sanitizeNextPath } from "@/lib/auth/session";
import { inputClassName } from "@/components/ui/Field";
import BrandLogo from "@/components/branding/BrandLogo";
import { useBranding } from "@/contexts/BrandingContext";

const TABS = {
  MOBILE: "mobile",
  USERNAME: "username",
  GOOGLE: "google"
};

const METHODS = [
  { key: TABS.MOBILE, label: "Mobile OTP", icon: Smartphone },
  { key: TABS.USERNAME, label: "Password", icon: KeyRound },
  { key: TABS.GOOGLE, label: "Google", icon: GoogleMark }
];

function GoogleMark({ size = 19 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.6c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.9v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.2 13.8A6 6 0 0 1 5.9 12c0-.6.1-1.2.3-1.8V7.5H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.5l3.3-2.7Z" />
      <path fill="#EA4335" d="M12 5.9c1.6 0 3 .5 4.1 1.6l3.1-3A10 10 0 0 0 2.9 7.5l3.3 2.7C7 7.7 9.3 5.9 12 5.9Z" />
    </svg>
  );
}

function OtpInputs({ value, onChange, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || "");

  function updateDigit(index, next) {
    const digit = next.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    onChange(nextDigits.join(""));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 6) - 1]?.focus();
  }

  return (
    <div className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => { refs.current[index] = node; }}
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          disabled={disabled}
          aria-label={`OTP digit ${index + 1}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          className="aspect-square min-w-0 rounded-xl border border-[var(--gv-border)] bg-white text-center text-lg font-bold text-slate-950 outline-none transition focus:border-[var(--gv-blue)] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
        />
      ))}
    </div>
  );
}

function Feedback({ error, message, onUseMobile, onUsePassword }) {
  if (!error && !message) return null;
  const isGoogleSetup = Boolean(error && /google/i.test(error) && /(not linked|setup|required|connect)/i.test(error));
  const isPhoneConfiguration = Boolean(error && /(SMS region policy|Authorized domains|Phone OTP request)/i.test(error));
  if (message) {
    return (
      <div role="status" className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
        <span>{message}</span>
      </div>
    );
  }
  return (
    <div role="alert" className={`mt-5 rounded-2xl border px-4 py-3.5 text-sm ${isGoogleSetup ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-700"}`}>
      {isGoogleSetup ? <p className="font-bold">Google account setup required</p> : null}
      <p className={isGoogleSetup ? "mt-1 leading-6" : "leading-6"}>{error}</p>
      {isPhoneConfiguration ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-white/70 p-3 text-xs leading-5 text-red-800">
          <p className="font-bold">Firebase console checklist</p>
          <p className="mt-1">Authentication → Settings → SMS region policy: allow India.</p>
          <p>Authentication → Settings → Authorized domains: add insights.growvest.info.</p>
          <p>Project settings → Web app: redeploy the matching production Firebase config.</p>
        </div>
      ) : null}
      {isGoogleSetup ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onUseMobile} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold ring-1 ring-inset ring-amber-200">Use Mobile OTP</button>
          <button type="button" onClick={onUsePassword} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold ring-1 ring-inset ring-amber-200">Use Password</button>
        </div>
      ) : null}
    </div>
  );
}

export default function InvestorLoginPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const { isAuthenticated, isInvestor, isStaff, loading, authorizationError, clearAuthorizationError } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.MOBILE);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const recaptchaRef = useRef(null);

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (isStaff) return router.replace("/dashboard");
    if (isInvestor) {
      const requested = new URLSearchParams(window.location.search).get("next");
      router.replace(sanitizeNextPath(requested, "/investor/dashboard", "/investor"));
    }
  }, [isAuthenticated, isInvestor, isStaff, loading, router]);

  useEffect(() => () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const visibleError = error || authorizationError;
  const sanitizedPhone = useMemo(() => phoneNumber.trim(), [phoneNumber]);

  function resetFeedback() {
    setError("");
    setMessage("");
    clearAuthorizationError();
  }

  function changeMethod(method) {
    setActiveTab(method);
    resetFeedback();
  }

  function redirectInvestor() {
    const requested = new URLSearchParams(window.location.search).get("next");
    router.replace(sanitizeNextPath(requested, "/investor/dashboard", "/investor"));
  }

  async function handleUsernameLogin(event) {
    event.preventDefault();
    resetFeedback();
    setSubmitting(true);
    try {
      await signInInvestorWithUsername(username, password);
      redirectInvestor();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    resetFeedback();
    setSubmitting(true);
    try {
      await signInInvestorWithGooglePopup();
      redirectInvestor();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestOtp() {
    resetFeedback();
    setSubmitting(true);
    try {
      if (!/^\+[1-9]\d{7,14}$/.test(sanitizedPhone)) throw new Error("Enter the registered mobile number with country code, for example +919876543210.");
      recaptchaRef.current?.clear();
      recaptchaRef.current = createInvestorRecaptcha("investor-recaptcha");
      const result = await sendInvestorOtp(sanitizedPhone, recaptchaRef.current);
      setConfirmationResult(result);
      setOtp("");
      setResendSeconds(30);
      setMessage("A 6-digit OTP was sent to your registered mobile number.");
    } catch (sendError) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setError(sendError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOtp(event) {
    event.preventDefault();
    await requestOtp();
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    resetFeedback();
    if (!confirmationResult) return setError("Request an OTP before attempting verification.");
    if (!/^\d{6}$/.test(otp)) return setError("Enter the complete 6-digit OTP.");
    setSubmitting(true);
    try {
      await verifyInvestorOtp(confirmationResult, otp);
      redirectInvestor();
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--gv-ink)] lg:grid lg:grid-cols-[minmax(420px,0.88fr)_minmax(620px,1.12fr)]">
      <section className="min-h-[100dvh] bg-white lg:flex lg:flex-col lg:justify-center lg:bg-[var(--gv-surface)] lg:px-8 lg:py-10">
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,#0b0b0f_0%,#13224d_56%,var(--gv-blue)_100%)] px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-8 lg:hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-4 top-10 h-48 w-48 rounded-full border border-cyan-300/20" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-xl"><BrandLogo variant="wide" className="max-w-[165px]" /></div>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">Investor App</span>
          </div>
          <div className="relative mt-9 max-w-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">Secure wealth access</p>
            <h1 className="mt-3 font-heading text-[2.55rem] font-bold leading-[0.98] tracking-[-0.045em] text-white sm:text-5xl">Your wealth journey, always within reach.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">Open reports, goals, meetings, documents and investor updates from one private mobile workspace.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Bank-grade sign-in", "Live app alerts", "Advisor guided"].map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white"><CheckCircle2 size={13} className="text-cyan-200" /> {item}</span>)}
            </div>
          </div>
        </div>

        <div className="relative z-10 -mt-10 rounded-t-[32px] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_-20px_60px_rgba(11,11,15,.16)] sm:mx-auto sm:-mt-12 sm:w-[calc(100%-3rem)] sm:max-w-[500px] sm:rounded-[30px] sm:px-8 sm:pb-8 lg:mt-0 lg:w-full lg:max-w-[460px] lg:rounded-[28px] lg:border lg:border-slate-200 lg:p-9 lg:shadow-[var(--gv-shadow-card)]">
          <div className="hidden items-center justify-between gap-4 lg:flex">
            <BrandLogo variant="wide" className="max-w-[210px]" />
            <div className="border-l border-slate-200 pl-4 text-right">
              <p className="font-heading text-sm">Investor Portal</p>
              <p className="text-[11px] text-slate-500">Secure client access</p>
            </div>
          </div>

          <div className="lg:mt-9">
            <p className="gv-eyebrow">Welcome back</p>
            <h2 className="mt-1 font-heading text-[2rem] font-bold leading-[1.03] text-slate-950 sm:text-[2.3rem] lg:text-[2.45rem]">Sign in to your investor app.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">Use your registered mobile number for the fastest secure access.</p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Investor login methods">
            {METHODS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => changeMethod(key)}
                className={`flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition sm:text-sm ${activeTab === key ? "bg-white text-[var(--gv-blue)] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800"}`}
              >
                <Icon size={17} />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            ))}
          </div>

          <Feedback error={visibleError} message={message} onUseMobile={() => changeMethod(TABS.MOBILE)} onUsePassword={() => changeMethod(TABS.USERNAME)} />

          {activeTab === TABS.MOBILE ? (
            <div className="mt-6">
              {!confirmationResult ? (
                <form onSubmit={handleSendOtp} className="grid gap-5">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Registered mobile number
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                      <input className={`${inputClassName} min-h-14 rounded-2xl pl-12 text-base font-semibold`} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+91 98765 43210" inputMode="tel" autoComplete="tel" required />
                    </div>
                    <span className="text-xs font-normal leading-5 text-slate-500">Use the mobile number registered with your GrowVest profile.</span>
                  </label>
                  <button type="submit" disabled={submitting} className="min-h-14 rounded-2xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(31,78,216,.24)] transition hover:bg-[var(--gv-blue-strong)] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Sending secure OTP…" : "Send OTP and continue"}</button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="grid gap-5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-slate-700">Enter 6-digit OTP</label>
                      <button type="button" onClick={() => { setConfirmationResult(null); setOtp(""); resetFeedback(); }} className="text-xs font-semibold text-[var(--gv-blue)]">Change number</button>
                    </div>
                    <div className="mt-3"><OtpInputs value={otp} onChange={setOtp} disabled={submitting} /></div>
                  </div>
                  <button type="submit" disabled={submitting || otp.length !== 6} className="min-h-14 rounded-2xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(31,78,216,.24)] transition hover:bg-[var(--gv-blue-strong)] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Verifying…" : "Verify and open app"}</button>
                  <div className="text-center text-xs text-slate-500">
                    {resendSeconds > 0 ? `Resend OTP in 00:${String(resendSeconds).padStart(2, "0")}` : <button type="button" onClick={requestOtp} disabled={submitting} className="font-semibold text-[var(--gv-blue)]">Resend OTP</button>}
                  </div>
                </form>
              )}
              <div id="investor-recaptcha" />
            </div>
          ) : null}

          {activeTab === TABS.USERNAME ? (
            <form onSubmit={handleUsernameLogin} className="mt-6 grid gap-5">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                GrowVest username
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input className={`${inputClassName} min-h-14 rounded-2xl pl-12`} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="arjun.mehta" autoComplete="username" required />
                </div>
                <span className="text-xs font-normal leading-5 text-slate-500">Enter your GrowVest username, not your email address.</span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Password
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input className={`${inputClassName} min-h-14 rounded-2xl pl-12 pr-12`} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </label>
              <button type="submit" disabled={submitting} className="min-h-14 rounded-2xl bg-[var(--gv-blue)] px-4 text-sm font-bold text-white shadow-[0_12px_28px_rgba(31,78,216,.24)] transition hover:bg-[var(--gv-blue-strong)] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Signing in…" : "Sign in securely"}</button>
              <p className="text-center text-xs leading-5 text-slate-500">Contact your Advisor to reset access or enable another login method.</p>
            </form>
          ) : null}

          {activeTab === TABS.GOOGLE ? (
            <div className="mt-6 grid gap-4">
              <button type="button" onClick={handleGoogleLogin} disabled={submitting} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl border border-[var(--gv-border)] bg-white px-4 text-sm font-bold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60">
                <GoogleMark /> {submitting ? "Connecting to Google…" : "Continue with Google"}
              </button>
              <p className="text-center text-xs leading-5 text-slate-500">Use the Google account already connected from Login &amp; Security.</p>
            </div>
          ) : null}

          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 text-xs leading-5 text-emerald-900">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--gv-success)]" size={18} />
            <p>Your financial information is protected and available only through your authorised GrowVest account.</p>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 text-center">
            <p className="text-xs text-slate-500 sm:text-sm">GrowVest Advisor or Administrator?</p>
            <Link href="/staff-login" className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[var(--gv-blue)] hover:bg-blue-50">Open Staff Login <ChevronRight size={16} /></Link>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-slate-400">
            <a href="mailto:connect@growvest.info">Contact Support</a><span aria-hidden="true">·</span><span>Privacy</span><span aria-hidden="true">·</span><span>Terms</span>
          </div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden bg-[var(--gv-ink)] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-white/5" />
        <div className="absolute -right-4 top-6 h-72 w-72 rounded-full border border-cyan-400/10" />
        <div className="relative">
          <BrandLogo variant="wide" showTagline inverse className="max-w-sm" />
          <p className="mt-10 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">Your wealth journey</p>
        </div>
        <div className="relative max-w-2xl">
          <h2 className="font-heading text-5xl leading-[1.02] text-white xl:text-6xl">Review progress with clarity and confidence.</h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">Your portal displays only completed reports and client-shareable information approved by {branding.companyName || "GrowVest"}.</p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            {["Secure access", "Published reports", "Advisor guided"].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-white/90">{item}</div>)}
          </div>
        </div>
        <p className="relative text-xs text-slate-500">Secure investor access · Confidential · {branding.tagline}</p>
      </section>
    </main>
  );
}
