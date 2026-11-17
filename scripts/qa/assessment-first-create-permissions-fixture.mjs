import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { join } from "node:path";

const cwd = process.cwd();
const rules = readFileSync(join(cwd, "firestore.rules"), "utf8");
const ui = readFileSync(join(cwd, "src/components/assessment/AssessmentPageClient.js"), "utf8");
const service = readFileSync(join(cwd, "src/services/assessmentService.js"), "utf8");
let checks = 0;
function check(statement, message) { assert.ok(statement, message); checks++; }

const match = rules.match(/match \/clientAssessments\/\{assessmentId\} \{([\s\S]*?)\n    \}/);
check(Boolean(match), "Client assessment rule exists");
const assessmentRule = match[1];
check(rules.includes("function advisorOwnsAssessmentLead(leadId)"), "Dedicated lead ownership guard exists");
check(rules.includes("exists(/databases/$(database)/documents/leads/$(leadId))"), "Lead must exist");
check(rules.includes("get(/databases/$(database)/documents/leads/$(leadId)).data.get('assignedAdvisorUid', null) == request.auth.uid"), "Lead must be assigned to current advisor");
check(assessmentRule.includes("allow get: if isAdmin()"), "Admin reads retained");
check(assessmentRule.includes("advisorOwnsAssessmentLead(assessmentId)"), "Missing assessment authorized by lead ID");
check(assessmentRule.includes("resource != null && ownsAdvisorRecord(resource.data)"), "Existing assessment ownership check preserved");
check(assessmentRule.includes("allow list: if isAdmin() || ownsAdvisorRecord(resource.data);"), "List remains restricted");
check(assessmentRule.includes("allow create: if isStaff()"), "Original staff creation gate retained");
check(assessmentRule.includes("request.resource.data.createdByUid == request.auth.uid"), "Creator identity is enforced");
check(assessmentRule.includes("request.resource.data.assignedAdvisorUid == request.auth.uid"), "Assigned advisor must match creator");
check(assessmentRule.includes("advisorCanReferenceScope(request.resource.data)"), "Cross-lead reference checks retained");
check(assessmentRule.includes("preservesAdvisorScope()"), "Update ownership immutability retained");
check(assessmentRule.includes("allow delete: if isSuperAdmin();"), "Deletion permission unchanged");
check(service.includes('doc(db, "clientAssessments", leadId)'), "Client reads same assessment ID as lead");
check(service.includes('doc(db, "clientAssessments", lead.id)'), "Client writes same assessment ID as lead");
check(ui.includes('if (!values) return <div role="alert"'), "Assessment errors are displayed instead of indefinite spinner");
check(ui.includes('error?.code === "permission-denied"'), "Permission denial is actionable");
console.log(`Assessment first-create permission source checks: ${checks} passed.`);
