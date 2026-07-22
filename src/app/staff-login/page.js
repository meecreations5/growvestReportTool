"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";

import BrandLogo from "@/components/branding/BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { sanitizeNextPath } from "@/lib/auth/session";
import { getHomeRouteForRole } from "@/lib/constants/roles";
import {
  signInStaffWithMicrosoftPopup,
  signInStaffWithMicrosoftRedirect
} from "@/services/authService";

function MicrosoftMark() {
  return (
    <svg
      viewBox="0 0 23 23"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

const workspaceBenefits = [
  "Secure organisational access",
  "Role-based internal workspace",
  "Confidential client information"
];

function getErrorMessage(loginError) {
  if (typeof loginError?.message === "string" && loginError.message.trim()) {
    return loginError.message;
  }

  return "We could not connect to Microsoft. Please check your connection and try again.";
}

export default function StaffLoginPage() {
  const router = useRouter();
  const { branding } = useBranding();

  const {
    isAuthenticated,
    profile,
    loading,
    authorizationError,
    clearAuthorizationError
  } = useAuth();

  const [activeLoginMethod, setActiveLoginMethod] = useState(null);
  const [error, setError] = useState("");

  const isSubmitting = activeLoginMethod !== null;
  const companyName = branding?.companyName || "GrowVest";

  function getAuthenticatedDestination(userProfile) {
    const requestedPath = new URLSearchParams(
      window.location.search
    ).get("next");

    const homeRoute = getHomeRouteForRole(userProfile.role);

    return requestedPath?.startsWith("/investor")
      ? homeRoute
      : sanitizeNextPath(requestedPath, homeRoute);
  }

  useEffect(() => {
    if (loading || !isAuthenticated || !profile) return;

    router.replace(getAuthenticatedDestination(profile));
  }, [isAuthenticated, loading, profile, router]);

  function resetErrors() {
    setError("");
    clearAuthorizationError();
  }

  async function handleMicrosoftLogin() {
    if (isSubmitting) return;

    setActiveLoginMethod("popup");
    resetErrors();

    try {
      const { profile: signedInProfile } =
        await signInStaffWithMicrosoftPopup();

      router.replace(getAuthenticatedDestination(signedInProfile));
    } catch (loginError) {
      setError(getErrorMessage(loginError));
      setActiveLoginMethod(null);
    }
  }

  async function handleRedirectLogin() {
    if (isSubmitting) return;

    setActiveLoginMethod("redirect");
    resetErrors();

    try {
      await signInStaffWithMicrosoftRedirect();
    } catch (loginError) {
      setError(getErrorMessage(loginError));
      setActiveLoginMethod(null);
    }
  }

  const visibleError = error || authorizationError;

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#F4F6F9] lg:grid lg:grid-cols-[1.27fr_1fr]">
      {/* Desktop brand panel */}
      <section className="relative hidden min-h-dvh overflow-hidden bg-[#050816] px-12 py-11 text-white lg:flex lg:flex-col xl:px-16 xl:py-12">
        {/* Decorative elements */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-48 -top-48 h-[520px] w-[520px] rounded-full border border-[#1F4ED8]/20"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-28 -top-28 h-[360px] w-[360px] rounded-full bg-[#1F4ED8]/[0.06]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-28 left-12 h-px w-64 bg-[#20B8CD]/40 xl:left-16"
        />

        <header className="relative z-10">
          <div className="max-w-[230px]">
            <BrandLogo
              variant="wide"
              inverse
              className="max-h-12 w-auto max-w-[200px]"
            />
          </div>

          <p className="mt-3 text-sm font-medium text-white/65">
            {branding?.brandPositioning ||
              "Your Conscious Wealth Partner"}
          </p>
        </header>

        <div className="relative z-10 my-auto max-w-[650px] py-16">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#62D7E5]">
            Staff Workspace
          </p>

          <h1 className="mt-6 max-w-[610px] font-heading text-[48px] font-bold leading-[1.02] tracking-[-0.025em] !text-white xl:text-[58px]">
            One disciplined workspace for every client journey.
          </h1>

          <p className="mt-7 max-w-[550px] text-[17px] leading-8 text-white/70">
            Manage leads, assessments, meetings, client servicing and
            monthly reporting through one secure {companyName} workspace.
          </p>

          <div className="mt-9 space-y-4">
            {workspaceBenefits.map((benefit) => (
              <div
                key={benefit}
                className="flex items-center gap-3 text-sm font-medium text-white/80"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1F4ED8]/20 text-[#62D7E5]">
                  <CheckCircle2 size={15} strokeWidth={2.25} />
                </span>

                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        <footer className="relative z-10">
          <p className="text-xs text-white/40">
            Internal Use Only · Confidential
          </p>
        </footer>
      </section>

      {/* Login section */}
      <section className="flex min-h-dvh items-center justify-center bg-white px-5 py-7 sm:bg-[#F4F6F9] sm:px-6 sm:py-10 lg:min-h-0 lg:px-10 xl:px-14">
        <div className="w-full max-w-[440px]">
          {/* Mobile and tablet branding */}
          <header className="mb-8 lg:hidden">
            <BrandLogo
              variant="wide"
              className="max-h-11 w-auto max-w-[185px]"
            />

            <p className="mt-3 text-xs font-bold uppercase tracking-[0.17em] text-[#6B7280]">
              Staff Workspace
            </p>
          </header>

          <div className="bg-white sm:rounded-[22px] sm:border sm:border-[#E3E8F0] sm:p-8 sm:shadow-[0_24px_70px_rgba(15,23,42,0.10)] md:p-10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#1F4ED8]">
              <ShieldCheck size={16} strokeWidth={2.2} />
              Secure Staff Access
            </div>

            <h2 className="mt-3 font-heading text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#0B0B0F] sm:text-[34px]">
              Welcome back
            </h2>

            <p className="mt-3 text-[15px] leading-6 text-[#6B7280]">
              Continue securely using your authorised Microsoft 365
              organisational account.
            </p>

            {visibleError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-6 rounded-xl border border-[#E53935]/25 bg-[#E53935]/[0.06] px-4 py-3.5"
              >
                <p className="text-sm font-semibold text-[#B42318]">
                  Sign-in unsuccessful
                </p>

                <p className="mt-1 text-sm leading-5 text-[#B42318]">
                  {visibleError}
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isSubmitting}
              aria-busy={activeLoginMethod === "popup"}
              className="mt-7 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-[#1F4ED8] px-5 py-3 text-[15px] font-semibold text-white transition duration-200 hover:bg-[#183FB3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1F4ED8]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeLoginMethod === "popup" ? (
                <LoaderCircle
                  size={20}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <MicrosoftMark />
              )}

              <span>
                {activeLoginMethod === "popup"
                  ? "Connecting securely…"
                  : "Continue with Microsoft"}
              </span>
            </button>

            <div className="mt-4 flex items-center justify-center gap-2 text-center text-xs leading-5 text-[#6B7280]">
              <LockKeyhole
                size={14}
                className="shrink-0 text-[#1F4ED8]"
                aria-hidden="true"
              />

              <span>
                Secure organisational authentication through Microsoft 365
              </span>
            </div>

            <p className="mt-4 text-center text-sm text-[#6B7280]">
              Popup not opening?{" "}
              <button
                type="button"
                onClick={handleRedirectLogin}
                disabled={isSubmitting}
                aria-busy={activeLoginMethod === "redirect"}
                className="inline-flex min-h-11 items-center font-semibold text-[#1F4ED8] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4ED8]/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeLoginMethod === "redirect"
                  ? "Redirecting securely…"
                  : "Use redirect sign-in"}
              </button>
            </p>

            <div className="mt-7 rounded-xl bg-[#F4F6F9] px-5 py-4 text-center">
              <p className="text-sm leading-5 text-[#6B7280]">
                Accessing your personal wealth portal?
              </p>

              <Link
                href="/investor-login"
                className="mt-1 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[#1F4ED8] hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4ED8]/30"
              >
                Open Investor Portal
              </Link>
            </div>
          </div>

          <footer className="mt-7 flex items-center justify-center gap-5 text-xs text-[#6B7280] lg:hidden">
            <a
              href={`mailto:${branding?.supportEmail || "connect@growvest.info"}`}
              className="inline-flex min-h-11 items-center hover:text-[#1F4ED8]"
            >
              Support
            </a>

            <span aria-hidden="true" className="text-[#D1D5DB]">
              ·
            </span>

            <span>Secure and confidential</span>
          </footer>
        </div>
      </section>
    </main>
  );
}