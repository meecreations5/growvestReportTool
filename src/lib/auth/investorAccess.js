const PREFIX = "gv.activeInvestor.";

export function investorAccessStorageKey(uid = "") {
  return `${PREFIX}${String(uid || "").trim()}`;
}

export function getStoredActiveInvestorId(uid = "") {
  if (typeof window === "undefined" || !uid) return "";
  try { return String(window.localStorage.getItem(investorAccessStorageKey(uid)) || "").trim(); }
  catch { return ""; }
}

export function setStoredActiveInvestorId(uid = "", investorId = "") {
  if (typeof window === "undefined" || !uid) return;
  const key = investorAccessStorageKey(uid);
  try {
    if (investorId) window.localStorage.setItem(key, String(investorId));
    else window.localStorage.removeItem(key);
  } catch {}
}

export function clearStoredActiveInvestorId(uid = "") {
  setStoredActiveInvestorId(uid, "");
}
