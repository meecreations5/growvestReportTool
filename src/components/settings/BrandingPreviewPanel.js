"use client";

import {
  BarChart3,
  Bell,
  FileText,
  LockKeyhole,
  Mail,
  Menu,
  ShieldCheck,
  TrendingUp,
  UserRound
} from "lucide-react";

const PREVIEWS = [
  ["application", "Application"],
  ["staff-login", "Staff Login"],
  ["investor-login", "Investor Login"],
  ["email", "Email"],
  ["html-report", "HTML Report"],
  ["a4-pdf", "A4 PDF"]
];

function Logo({ branding, inverse = false, compact = false, className = "" }) {
  const source = inverse
    ? (branding.whiteLogoUrl || branding.primaryLogoUrl || branding.iconLogoUrl)
    : (branding.primaryLogoUrl || branding.iconLogoUrl);

  if (source) {
    return (
      <img
        src={source}
        alt={`${branding.companyName || "GrowVest"} logo preview`}
        className={`${compact ? "max-h-7 max-w-[118px]" : "max-h-9 max-w-[160px]"} object-contain object-left ${className}`}
      />
    );
  }

  return (
    <div className={`font-heading text-xl font-bold ${inverse ? "text-white" : "text-[var(--preview-dark)]"} ${className}`}>
      {branding.companyName || "GrowVest"}
    </div>
  );
}

function ApplicationPreview({ branding }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[var(--preview-surface)] shadow-sm">
      <div className="grid min-h-[390px] grid-cols-[112px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-white p-3">
          <Logo branding={branding} compact />
          <div className="mt-7 grid gap-2">
            {["Dashboard", "Investors", "Reports", "Settings"].map((item, index) => (
              <div key={item} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold ${index === 0 ? "bg-[var(--preview-primary-soft)] text-[var(--preview-primary)]" : "text-slate-500"}`}>
                <span className="h-4 w-4 rounded bg-slate-100" /> {item}
              </div>
            ))}
          </div>
        </aside>
        <div>
          <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500"><Menu size={14} /> Workspace / Dashboard</div>
            <div className="flex items-center gap-2"><Bell size={14} className="text-slate-500" /><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--preview-primary)] text-[9px] font-bold text-white">GV</span></div>
          </header>
          <main className="p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--preview-primary)]">Monthly reporting</p>
            <h3 className="mt-1 font-heading text-xl font-bold text-[var(--preview-dark)]">Monthly Report Dashboard</h3>
            <p className="mt-1 text-[10px] text-[var(--preview-muted)]">Create, review and deliver Investor reports.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {["Reports due", "Under review", "Approved", "Sent"].map((label, index) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className={`block h-1 w-8 rounded-full ${index === 2 ? "bg-emerald-500" : "bg-[var(--preview-primary)]"}`} />
                  <strong className="mt-3 block text-lg text-[var(--preview-dark)]">{[18, 6, 10, 8][index]}</strong>
                  <span className="text-[9px] text-[var(--preview-muted)]">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-[var(--preview-dark)]">Report completion</span><span className="text-[9px] font-semibold text-[var(--preview-primary)]">72%</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[72%] rounded-full bg-[var(--preview-primary)]" /></div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function StaffLoginPreview({ branding }) {
  return (
    <div className="grid min-h-[390px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm sm:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden bg-[var(--preview-dark)] p-6 text-white sm:block">
        <Logo branding={branding} inverse />
        <p className="mt-2 text-[10px] text-white/60">{branding.brandPositioning}</p>
        <div className="mt-20">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--preview-secondary)]">Staff workspace</p>
          <h3 className="mt-3 max-w-xs font-heading text-3xl font-bold leading-[1.05] !text-white">One disciplined workspace for every client journey.</h3>
          <p className="mt-4 max-w-xs text-[10px] leading-5 text-white/65">Secure organisational access for GrowVest staff.</p>
        </div>
      </section>
      <section className="flex items-center bg-[var(--preview-surface)] p-5">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--preview-primary)]"><ShieldCheck size={14} /> Secure staff access</div>
          <h3 className="mt-3 font-heading text-2xl font-bold text-[var(--preview-dark)]">Welcome back</h3>
          <p className="mt-2 text-[10px] leading-5 text-[var(--preview-muted)]">Continue using your authorised Microsoft account.</p>
          <button type="button" className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--preview-primary)] text-[10px] font-bold text-white">Continue with Microsoft</button>
          <div className="mt-4 rounded-xl bg-[var(--preview-surface)] p-3 text-center text-[9px] text-[var(--preview-muted)]">Open Investor Portal</div>
        </div>
      </section>
    </div>
  );
}

function InvestorLoginPreview({ branding }) {
  return (
    <div className="mx-auto max-w-[330px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="bg-[var(--preview-dark)] px-6 py-7 text-white">
        <Logo branding={branding} inverse />
        <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--preview-secondary)]">Secure investor access</p>
        <h3 className="mt-2 font-heading text-2xl font-bold !text-white">Your wealth, always within reach.</h3>
        <p className="mt-2 text-[9px] leading-4 text-white/65">Reports, goals and Advisor updates in one secure workspace.</p>
      </div>
      <div className="p-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--preview-primary)]">Welcome back</p>
        <h3 className="mt-2 font-heading text-2xl font-bold text-[var(--preview-dark)]">Access your GrowVest portfolio</h3>
        <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-center text-[9px] font-bold"><span className="rounded-lg bg-white px-2 py-2 text-[var(--preview-primary)] shadow-sm">Mobile OTP</span><span className="px-2 py-2 text-slate-500">Password</span></div>
        <div className="mt-5 rounded-xl border border-slate-200 px-3 py-3 text-[10px] text-slate-400">Registered mobile number</div>
        <button type="button" className="mt-3 min-h-11 w-full rounded-xl bg-[var(--preview-primary)] text-[10px] font-bold text-white">Send secure OTP</button>
        <p className="mt-4 text-center text-[9px] text-[var(--preview-muted)]">Secure and confidential</p>
      </div>
    </div>
  );
}

function EmailPreview({ branding }) {
  const signatureSocialProfiles = branding.signatureSocialEnabled === false ? [] : [
    ["LinkedIn", branding.signatureLinkedInUrl],
    ["Instagram", branding.signatureInstagramUrl],
    ["Facebook", branding.signatureFacebookUrl],
    ["YouTube", branding.signatureYouTubeUrl],
    ["X", branding.signatureXUrl]
  ].filter(([, url]) => /^https?:\/\//i.test(String(url || "").trim()));

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-[var(--preview-primary)] px-6 py-5 text-white">
          {branding.emailLogoUrl ? <img src={branding.emailLogoUrl} alt="Email logo preview" className="max-h-10 max-w-[180px] object-contain object-left" /> : <Logo branding={branding} inverse />}
          <p className="mt-2 text-[10px] text-white/75">{branding.tagline}</p>
        </div>
        <div className="p-6">
          <p className="text-[10px] font-semibold text-[var(--preview-primary)]">MONTHLY WEALTH REPORT</p>
          <h3 className="mt-2 font-heading text-2xl font-bold text-[var(--preview-dark)]">Your July report is ready</h3>
          <p className="mt-3 text-[11px] leading-5 text-[var(--preview-muted)]">Hello Investor, your monthly report is available in the secure Investor Portal.</p>
          <button type="button" className="mt-5 rounded-lg bg-[var(--preview-primary)] px-4 py-3 text-[10px] font-bold text-white">View Monthly Report</button>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="font-heading text-sm font-bold text-[var(--preview-dark)]">GrowVest Advisor</p>
            <p className="mt-1 text-[9px] italic text-[var(--preview-muted)]">{branding.signatureBrandPositioning || branding.brandPositioning}</p>
            <p className="mt-2 text-[9px] leading-4 text-[var(--preview-muted)]">{branding.supportEmail} · {branding.signatureWebsite || branding.website}</p>
            {signatureSocialProfiles.length ? <div className="mt-2 flex flex-wrap gap-1">{signatureSocialProfiles.map(([label]) => <span key={label} className="rounded-full border border-[var(--preview-primary)] px-2 py-0.5 text-[7px] font-bold text-[var(--preview-primary)]">{label}</span>)}</div> : null}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 text-[9px] leading-4 text-[var(--preview-muted)]">{branding.emailFooterText}<br />{branding.supportEmail} · {branding.website}</div>
        </div>
      </div>
    </div>
  );
}

function HtmlReportPreview({ branding }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[var(--preview-dark)] p-5 text-white shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-white/70">{branding.confidentialLabel}</span>
        <Logo branding={branding} inverse compact className="justify-end" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--preview-primary)] text-xs font-bold">SS</span><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--preview-secondary)]">Monthly Wealth Progress Report</p><h3 className="mt-1 font-heading text-3xl font-bold !text-white">Investor&apos;s Wealth Journey</h3></div></div>
          <p className="mt-4 max-w-xl text-[11px] leading-5 text-white/70">A clear view of portfolio progress, financial priorities and recommended actions.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {["Reporting Period", "Statement Date", "Client ID", "Relationship"].map((label, index) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.06] p-3"><span className="text-[8px] text-white/50">{label}</span><strong className="mt-1 block text-[11px]">{["July 2026", "31 Jul 2026", "GV-CL-0001", "Active client"][index]}</strong></div>)}
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/[0.08] p-4">
          <p className="text-[9px] text-[var(--preview-secondary)]">YOUR ADVISOR</p>
          <strong className="mt-2 block text-sm">Connect GrowVest</strong>
          <span className="text-[9px] text-white/60">Relationship Advisor</span>
          <div className="mt-5 grid grid-cols-3 gap-2">{[Mail, UserRound, Bell].map((Icon, index) => <span key={index} className="grid h-9 place-items-center rounded-lg bg-white/10"><Icon size={13} className="text-[var(--preview-secondary)]" /></span>)}</div>
        </div>
      </div>
    </div>
  );
}

function PdfPreview({ branding }) {
  return (
    <div className="mx-auto aspect-[210/297] w-full max-w-[330px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-xl">
      <div className="flex h-full flex-col p-5">
        <header className="flex items-start justify-between border-b-2 border-[var(--preview-primary)] pb-3">
          <div><p className="text-[7px] font-bold uppercase tracking-[0.18em] text-[var(--preview-primary)]">Monthly Wealth Progress Report</p><p className="mt-1 text-[6px] uppercase tracking-[0.08em] text-slate-400">{branding.legalName}</p></div>
          {branding.pdfLogoUrl ? <img src={branding.pdfLogoUrl} alt="PDF logo preview" className="max-h-7 max-w-[110px] object-contain object-right" /> : <Logo branding={branding} compact />}
        </header>
        <main className="flex flex-1 flex-col justify-center">
          <p className="text-[7px] font-bold uppercase tracking-[0.22em] text-[var(--preview-primary)]">Confidential</p>
          <h3 className="mt-3 font-heading text-4xl font-bold leading-[0.95] text-[var(--preview-dark)]">Monthly<br />Wealth<br />Report</h3>
          <p className="mt-5 text-[9px] text-[var(--preview-muted)]">Investor Name · July 2026</p>
          <div className="mt-6 grid grid-cols-3 gap-2">{["₹12.5 L", "+2.45%", "68%"].map((value, index) => <div key={value} className="rounded-lg bg-[var(--preview-surface)] p-2"><span className="text-[6px] text-[var(--preview-muted)]">{["Portfolio", "Monthly return", "Goal progress"][index]}</span><strong className="mt-1 block text-[9px] text-[var(--preview-dark)]">{value}</strong></div>)}</div>
        </main>
        <footer className="border-t border-slate-200 pt-2">
          <div className="flex items-center gap-2">
            {branding.footerLogoUrl ? <img src={branding.footerLogoUrl} alt="Footer mark preview" className="h-7 w-7 object-contain" /> : <span className="grid h-7 w-7 place-items-center rounded bg-[var(--preview-primary)] text-[8px] font-bold text-white">GV</span>}
            <div><p className="text-[6px] font-bold uppercase text-[var(--preview-dark)]">{branding.legalName}</p><p className="text-[6px] italic text-[var(--preview-muted)]">{branding.documentFooterTagline}</p></div>
          </div>
          <p className="mt-2 text-[5px] text-[var(--preview-muted)]">{branding.supportMobile} · {branding.supportEmail} · {branding.website} · Page 01</p>
        </footer>
      </div>
    </div>
  );
}

export default function BrandingPreviewPanel({ branding, activePreview, onPreviewChange, sticky = true }) {
  const previewStyle = {
    "--preview-primary": branding.primaryColor || "#1F4ED8",
    "--preview-primary-soft": `${branding.primaryColor || "#1F4ED8"}14`,
    "--preview-secondary": branding.secondaryColor || "#20B8CD",
    "--preview-dark": branding.darkColor || "#0B0B0F",
    "--preview-surface": branding.surfaceColor || "#F4F6F9",
    "--preview-muted": branding.mutedColor || "#6B7280"
  };

  const preview = {
    application: <ApplicationPreview branding={branding} />,
    "staff-login": <StaffLoginPreview branding={branding} />,
    "investor-login": <InvestorLoginPreview branding={branding} />,
    email: <EmailPreview branding={branding} />,
    "html-report": <HtmlReportPreview branding={branding} />,
    "a4-pdf": <PdfPreview branding={branding} />
  }[activePreview] || <ApplicationPreview branding={branding} />;

  return (
    <aside className={`theme-static-preview ${sticky ? "xl:sticky xl:top-24 xl:self-start" : ""}`} style={previewStyle}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--gv-blue)]">Live preview</p>
            <h3 className="mt-1 font-heading text-xl font-bold text-slate-950">Review before publishing</h3>
          </div>
          <BarChart3 size={20} className="text-slate-400" />
        </div>

        <div className="gv-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Brand preview type">
          {PREVIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activePreview === key}
              onClick={() => onPreviewChange(key)}
              className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${activePreview === key ? "bg-[var(--gv-blue)] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5">{preview}</div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          <LockKeyhole size={15} className="mt-0.5 shrink-0 text-[var(--gv-blue)]" />
          Preview uses draft branding only. Live application, email and report output change after publishing.
        </div>
      </div>
    </aside>
  );
}
