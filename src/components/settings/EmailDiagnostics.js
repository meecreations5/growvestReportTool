"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MailCheck, ServerCog, XCircle } from "lucide-react";
import { checkEmailService, sendTestEmail } from "@/services/communicationService";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function EmailDiagnostics() {
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");

  async function runCheck() {
    setChecking(true);
    setMessage("");
    try {
      const response = await checkEmailService();
      setResult(response);
      setMessage("Brevo SMTP connection verified successfully.");
    } catch (error) {
      setResult({ ok: false, error: error.message });
      setMessage(error.message);
    } finally {
      setChecking(false);
    }
  }

  async function runTestEmail() {
    setSending(true);
    setMessage("");
    try {
      await sendTestEmail();
      setMessage("Test email sent to your staff email address.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Email diagnostics</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Brevo SMTP status</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Verify server-side credentials and send a test email before testing meeting invitations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={runCheck} disabled={checking}>
            {checking ? <Loader2 size={16} className="animate-spin" /> : <ServerCog size={16} />}
            Check connection
          </Button>
          <Button type="button" onClick={runTestEmail} disabled={sending}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <MailCheck size={16} />}
            Send test email
          </Button>
        </div>
      </div>

      {result ? (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          <div className="flex items-start gap-3">
            {result.ok ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> : <XCircle size={19} className="mt-0.5 shrink-0" />}
            <div>
              <p className="font-black">{result.ok ? "Connection ready" : "Connection failed"}</p>
              {result.host ? <p className="mt-1">SMTP: {result.host}:{result.port}</p> : null}
              {result.senderEmail ? <p>Sender: {result.senderEmail}</p> : null}
              {result.error ? <p className="mt-1 font-semibold">{result.error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p> : null}
    </Card>
  );
}
