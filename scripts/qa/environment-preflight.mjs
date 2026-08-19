import process from "node:process";

const strict = process.argv.includes("--strict") || process.env.NODE_ENV === "production";
const failures = [];
const warnings = [];

function value(name) { return String(process.env[name] || "").trim(); }
function requireValue(name, { min = 1, https = false } = {}) {
  const current = value(name);
  if (!current) {
    (strict ? failures : warnings).push(`${name} is not configured.`);
    return;
  }
  if (current.length < min) failures.push(`${name} must be at least ${min} characters.`);
  if (https && !/^https:\/\//i.test(current)) failures.push(`${name} must use HTTPS.`);
}

[
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID"
].forEach((name) => requireValue(name));

requireValue("NEXT_PUBLIC_APP_URL", { https: strict });
requireValue("KYC_FIELD_ENCRYPTION_KEY", { min: 32 });
requireValue("CRON_SECRET", { min: 32 });
requireValue("BREVO_WEBHOOK_TOKEN", { min: 32 });

if (strict) {
  requireValue("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY");
  requireValue("NEXT_PUBLIC_FIREBASE_VAPID_KEY");
  requireValue("BREVO_SMTP_USER");
  requireValue("BREVO_SMTP_PASSWORD", { min: 12 });
  requireValue("BREVO_DEFAULT_SENDER_EMAIL");
  if (value("NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG").toLowerCase() === "true") {
    failures.push("NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG must not be true in production.");
  }
}

const webProjectId = value("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const adminProjectId = value("FIREBASE_ADMIN_PROJECT_ID");
if (webProjectId && adminProjectId && webProjectId !== adminProjectId) {
  failures.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID and FIREBASE_ADMIN_PROJECT_ID must target the same Firebase project.");
}

const hasExplicitAdminCredentials = Boolean(value("FIREBASE_ADMIN_PROJECT_ID") && value("FIREBASE_ADMIN_CLIENT_EMAIL") && value("FIREBASE_ADMIN_PRIVATE_KEY"));
const hasApplicationDefault = Boolean(value("GOOGLE_APPLICATION_CREDENTIALS") || value("K_SERVICE") || value("FUNCTION_TARGET"));
if (!hasExplicitAdminCredentials && !hasApplicationDefault) {
  warnings.push("Firebase Admin credentials are not visible to this shell. This is expected on managed Google runtimes using Application Default Credentials; otherwise configure FIREBASE_ADMIN_* variables.");
}

if (value("FIREBASE_APP_CHECK_ENFORCE_SERVER").toLowerCase() === "true" && !value("NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY")) {
  failures.push("FIREBASE_APP_CHECK_ENFORCE_SERVER=true requires NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY.");
}

console.log("\nGrowVest production environment preflight");
console.log("=".repeat(48));
warnings.forEach((item) => console.log(`WARN  ${item}`));
failures.forEach((item) => console.log(`FAIL  ${item}`));
if (!warnings.length && !failures.length) console.log("PASS  Environment checks passed.");
console.log("-".repeat(48));
console.log(`${warnings.length} warning(s), ${failures.length} failure(s)`);
if (failures.length) process.exit(1);
