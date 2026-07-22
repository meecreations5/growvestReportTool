import nodemailer from "nodemailer";

let transporter;

export function getBrevoConfigurationStatus() {
  const required = {
    BREVO_SMTP_USER: process.env.BREVO_SMTP_USER,
    BREVO_SMTP_PASSWORD: process.env.BREVO_SMTP_PASSWORD,
    BREVO_DEFAULT_SENDER_EMAIL: process.env.BREVO_DEFAULT_SENDER_EMAIL
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !String(value || "").trim())
    .map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
    host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.BREVO_SMTP_PORT || 587),
    senderEmail: process.env.BREVO_DEFAULT_SENDER_EMAIL || "",
    senderName: process.env.BREVO_DEFAULT_SENDER_NAME || "GrowVest"
  };
}

function getTransporter() {
  if (transporter) return transporter;

  const configuration = getBrevoConfigurationStatus();
  if (!configuration.configured) {
    throw new Error(`Brevo SMTP is not configured. Missing: ${configuration.missing.join(", ")}.`);
  }

  transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASSWORD
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });

  return transporter;
}

export async function verifyBrevoConnection() {
  const configuration = getBrevoConfigurationStatus();
  if (!configuration.configured) {
    return {
      ok: false,
      ...configuration,
      error: `Missing environment variables: ${configuration.missing.join(", ")}`
    };
  }

  try {
    await getTransporter().verify();
    return { ok: true, ...configuration };
  } catch (error) {
    return {
      ok: false,
      ...configuration,
      error: error.message || "Brevo SMTP connection could not be verified."
    };
  }
}

export function resolveSender(advisor = {}) {
  const fallbackEmail = advisor.defaultSenderEmail || process.env.BREVO_DEFAULT_SENDER_EMAIL || "cwp@growvest.info";
  const fallbackName = advisor.defaultSenderName || process.env.BREVO_DEFAULT_SENDER_NAME || "GrowVest";
  const allowAdvisor = process.env.BREVO_ALLOW_ADVISOR_SENDERS === "true";
  const advisorEmail = String(advisor.senderEmail || advisor.email || "").trim();
  const fromEmail = allowAdvisor && advisorEmail.toLowerCase().endsWith("@growvest.info")
    ? advisorEmail
    : fallbackEmail;
  const fromName = advisor.fullName ? `${advisor.fullName} from ${advisor.companyName || "GrowVest"}` : fallbackName;

  return {
    from: { name: fromName, address: fromEmail },
    replyTo: advisor.replyToEmail || advisorEmail || process.env.BREVO_REPLY_TO_EMAIL || fallbackEmail
  };
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  advisor,
  attachments = []
}) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(
    (item) => item?.address || item?.email || typeof item === "string"
  );

  if (!recipients.length) {
    return { skipped: true, reason: "No recipient email address" };
  }

  const sender = resolveSender(advisor);
  const info = await getTransporter().sendMail({
    from: sender.from,
    replyTo: sender.replyTo,
    to: recipients.map((item) => (
      typeof item === "string"
        ? item
        : { name: item.name || "", address: item.address || item.email }
    )),
    subject,
    html,
    text,
    attachments
  });

  return {
    skipped: false,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response
  };
}
