import assert from "node:assert/strict";
import { pdfSafeLine, pdfSafeMultiline } from "../../src/lib/server/pdfTextSanitizer.js";

const direct = pdfSafeLine('  ₹24,298\nOpening\tWealth Review — “Investor” • 😀 \u0000  ');
assert.equal(direct, 'Rs. 24,298 Opening Wealth Review - "Investor" - ?');
assert.equal(/[\x00-\x1F\x7F-\x9F]/.test(direct), false, "single-line PDF text must contain no C0/C1 controls");
assert.equal(direct.includes("\n"), false, "single-line PDF text must never contain a newline");
assert.equal(direct.includes("\r"), false, "single-line PDF text must never contain a carriage return");
assert.equal(direct.includes("\t"), false, "single-line PDF text must never contain a tab");

const multiline = pdfSafeMultiline('Line one\r\nLine two\t₹1,000\n\nLine three — ok');
assert.equal(multiline, 'Line one\nLine two Rs. 1,000\n\nLine three - ok');
for (const line of multiline.split("\n")) {
  assert.equal(/[\x00-\x1F\x7F-\x9F]/.test(line), false, "each wrapped PDF line must be control-character safe");
}

console.log("PDF WinAnsi encoding fixture passed");
console.log(JSON.stringify({ direct, multiline }, null, 2));
