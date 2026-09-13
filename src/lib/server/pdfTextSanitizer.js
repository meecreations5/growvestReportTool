// pdf-lib StandardFonts use WinAnsi encoding. This module keeps text passed to
// StandardFonts inside the printable WinAnsi/Latin-1 range and removes C0/C1
// control characters from single-line drawText calls.
function normalisePdfGlyphs(value) {
  return String(value ?? "")
    .replace(/₹/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00b7/g, "|")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\xFF]+/g, "?");
}

export function pdfSafeLine(value) {
  return normalisePdfGlyphs(value)
    .replace(/[\x00-\x1F\x7F-\x9F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function pdfSafeMultiline(value) {
  const normalised = normalisePdfGlyphs(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ");
  return normalised
    .split("\n")
    .map((line) => pdfSafeLine(line))
    .join("\n");
}
