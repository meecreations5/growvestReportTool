import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeOfficialNavEvidence, parseAmfiHistoricalNav, matchOfficialNav } from '../../src/lib/amfiNavHistory.js';
import { assessFundbazaarHistoricalMonthEnd } from '../../src/lib/portfolioHistoricalMonthEnd.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const route = readFileSync(join(root, 'src/app/api/portfolio/valuation-history/approve-month-end/route.js'), 'utf8');
const ui = readFileSync(join(root, 'src/components/portfolio/InvestorDatedValuationHistory.js'), 'utf8');
const sample = parseAmfiHistoricalNav('133858;SBI BANKING & FINANCIAL SERVICES FUND - REGULAR PLAN - GROWTH;INF200KA1473;;41.16370;;;31-Oct-2026');
const holding = { isin: 'INF200KA1473', folioNo: 'FOLIO-1', instrumentName: 'SBI Banking & Financial Services Fund - Regular Plan - Growth',navDate:'2026-10-31',currentNav:41.1637 };
const official = {...matchOfficialNav(holding,sample),referenceUrl:'https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=31-Oct-2026&todt=31-Oct-2026', evidenceType:'automated_amfi_history_match'};
const blankBrowserProof = {isin: holding.isin, folioNo: holding.folioNo, navDate: holding.navDate, publishedNav:'', referenceUrl:''};
let count=0;
function test(name,fn){ fn(); console.log('PASS',name); count++; }
test('official historical match has exact scheme and date',()=>assert.equal(official.publishedNav,41.1637));
test('server evidence outranks blank browser proof',()=>assert.deepEqual(mergeOfficialNavEvidence([official],[blankBrowserProof]),[official]));
test('explicit staff proof fallback remains when AMFI unavailable',()=>assert.deepEqual(mergeOfficialNavEvidence([], [blankBrowserProof]),[blankBrowserProof]));
test('server evidence retains other genuine independent submissions',()=>{
 const p2={...blankBrowserProof, folioNo:'OTHER', publishedNav:'41.1637'};
 assert.deepEqual(mergeOfficialNavEvidence([official],[blankBrowserProof,p2]),[official,p2]);
});
test('unverified other date never receives false official match',()=>assert.equal(matchOfficialNav({...holding,navDate:'2026-10-30'},sample),null));
test('incorrect current NAV cannot receive official match',()=>assert.equal(matchOfficialNav({...holding,currentNav:41.1652},sample),null));
test('preview and approval route use the shared official checker',()=>{
 assert.ok(route.includes('const official = officialNavCheck || await loadOfficialWeekendNavEvidence(holdings);'));
 assert.ok(route.includes('weekendNavEvidence: verifiedEvidence'));
 assert.ok(route.includes('const prepared = await prepare({ actor, investorId, valuationId, monthKey, weekendNavEvidence, officialNavCheck });'));
 assert.ok(route.includes('if (!approve) return Response.json({ ready: eligibility.ready, eligibility, navVerification: prepared.navVerification'));
});
test('auto request official evidence reused, not refetched',()=>{
 assert.ok(route.includes('officialNavCheck = official;'));
});
test('UI communicates success or precise missing evidence',()=>{
 assert.ok(ui.includes('automatically matched'));
 assert.ok(ui.includes('Automatic AMFI NAV check verified'));
});
console.log(`\n${count} month-end preview NAV regression checks passed.`);
