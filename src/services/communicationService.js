import { auth } from "@/lib/firebase/client";

async function postAuthenticated(url, body) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to send communication.");

  const token = await user.getIdToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.error || "Communication could not be sent.");
  }

  return result;
}

async function getAuthenticated(url) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to check communication settings.");

  const token = await user.getIdToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Communication service check failed.");
  return result;
}

export function sendMeetingCommunication(meetingId, eventType = "meeting_scheduled") {
  return postAuthenticated("/api/communications/meeting", { meetingId, eventType });
}

export function sendMomCommunication(momId) {
  return postAuthenticated("/api/communications/mom", { momId });
}

export function sendReportCommunication(reportId) {
  return postAuthenticated("/api/communications/report", { reportId });
}

export function checkEmailService() {
  return getAuthenticated("/api/communications/health");
}

export function sendTestEmail() {
  return postAuthenticated("/api/communications/test-email", {});
}

export function publishReportVersion(reportId, { sendEmail = true } = {}) {
  return postAuthenticated(`/api/reports/${reportId}/publish`, { sendEmail });
}

export function generateReportPdf(reportId) {
  return postAuthenticated(`/api/reports/${reportId}/generate-pdf`, {});
}

export async function downloadReportPdf(reportId, versionId = "") {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in to download this report.");
  const token = await user.getIdToken();
  const suffix = versionId ? `?versionId=${encodeURIComponent(versionId)}` : "";
  const response = await fetch(`/api/reports/${reportId}/pdf${suffix}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Report PDF could not be downloaded.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^\"]+)"?/i);
  const fileName = match?.[1] || "GrowVest-monthly-report.pdf";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { fileName };
}

export function submitReportAcknowledgement(reportId, { requestDiscussion = false, comment = "" } = {}) {
  return postAuthenticated(`/api/reports/${reportId}/acknowledge`, { requestDiscussion, comment });
}

export function updateInvestorPortalAccess(investorId, payload) {
  return postAuthenticated(`/api/investors/${investorId}/portal-access`, payload);
}

export function notifyInvestorDocumentUploaded(documentId) {
  return postAuthenticated(`/api/investor-documents/${documentId}/uploaded`, {});
}
