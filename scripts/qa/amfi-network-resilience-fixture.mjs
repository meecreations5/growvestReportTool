import assert from 'node:assert/strict';
import { loadOfficialWeekendNavEvidence } from '../../src/lib/server/amfiOfficialNavEvidence.js';
let tests = 0;
async function check(name, fn) { await fn(); tests++; console.log('PASS', name); }
const realFetch = globalThis.fetch;
const record = (date,nav) => `133858;SBI BANKING & FINANCIAL SERVICES FUND - REGULAR PLAN - GROWTH;INF200KA1473;;${nav};;;${date}`;
const response = (body) => ({ok:true, status:200, headers:{get:()=>String(body.length)}, text:async()=>body});
const base = { isin: 'INF200KA1473', folioNo:'EXAMPLE', navDate:'2026-10-25', currentNav:41.1637 };
try {
 let calls = 0;
 globalThis.fetch=async(url)=>{calls++; assert.match(String(url),/^https:\/\/portal\.amfiindia\.com\//); return response(record('25-Oct-2026','41.16370'));};
 const verified = await loadOfficialWeekendNavEvidence([base]);
 await check('official match marks weekend NAV as verified',()=>{ assert.equal(verified.verified,1);assert.equal(verified.required,1);assert.equal(verified.evidence[0].publishedNav,41.1637); });
 await check('Saturday does not make slow AMFI network request mandatory',async()=>{
  const before=calls;
  const result=await loadOfficialWeekendNavEvidence([{...base,navDate:'2026-10-31'}]);
  assert.equal(result.required,0);assert.equal(result.verified,0);assert.equal(calls,before);
 });
 await check('successful official date response cached across investor requests', async()=>{
  const more=await loadOfficialWeekendNavEvidence([{...base,folioNo:'ANOTHER-INVESTOR'}]);
  assert.equal(more.verified,1);assert.equal(calls,1);
 });
 let stubCalls=0;
 globalThis.fetch=async(url)=>{
  stubCalls++;
  return response(stubCalls === 1 ? 'No rows available' : record('18-Oct-2026','41.00120'));
 };
 await check('no-data AMFI response triggers range retry without fabricating date',async()=>{
  const result=await loadOfficialWeekendNavEvidence([{...base,navDate:'2026-10-18',currentNav:41.0012}]);
  assert.equal(result.verified,1);assert.equal(stubCalls,2);assert.ok(result.evidence[0].referenceUrl.includes('frmdt=15-Oct-2026')); 
 });
 globalThis.fetch=async()=>response(record('01-Nov-2026','41.00010'));
 await check('official mismatched NAV amount stays blocked',async()=>{
  const result=await loadOfficialWeekendNavEvidence([{...base,navDate:'2026-11-01',currentNav:52}]);
  assert.equal(result.verified,0);assert.equal(result.required,1);
  assert.match(result.issue,/ISIN, date, and amount/);
 });
 let fails=0;
 globalThis.fetch=async()=>{fails++;throw new Error('offline');};
 await check('official outage fails closed with actionable error',async()=>{
  const result=await loadOfficialWeekendNavEvidence([{...base,navDate:'2026-11-08'}]);
  assert.equal(result.verified,0);assert.equal(fails,2);assert.match(result.issue,/offline/);
 });
 console.log(`\n${tests} AMFI network resilience checks passed.`);
} finally { globalThis.fetch=realFetch; }
