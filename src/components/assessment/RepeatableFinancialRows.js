"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  EXISTING_INVESTMENT_TYPES,
  GOAL_OPTIONS,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  GOAL_TYPES,
  LIABILITY_TYPES,
  SURPLUS_ALLOCATION_TYPES
} from "@/lib/constants/assessment";
import Button from "@/components/ui/Button";
import { Field, inputClassName } from "@/components/ui/Field";
import { formatCurrency } from "@/lib/utils/format";

function RowHeader({ title, badge, onRemove, disabled, canRemove = true }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-black text-slate-950">{title}</p>
        {badge ? <p className="mt-1 text-xs font-semibold text-blue-700">{badge}</p> : null}
      </div>
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={15} /> Remove
        </button>
      ) : null}
    </div>
  );
}

export function GoalBucketEditor({
  goals,
  errors = {},
  disabled = false,
  onAdd,
  onRemove,
  onChange,
  onSetPrimary
}) {
  return (
    <div className="grid gap-4">
      <datalist id="growvest-goal-options">
        {GOAL_OPTIONS.map((item) => <option key={item} value={item} />)}
      </datalist>

      {goals.map((goal, index) => (
        <div key={goal.id || index} className={`rounded-2xl border p-5 ${goal.isPrimary ? "border-blue-300 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
          <RowHeader
            title={`Goal ${index + 1}`}
            badge={goal.isPrimary ? "Primary goal" : "Additional goal"}
            onRemove={() => onRemove(index)}
            disabled={disabled}
            canRemove={goals.length > 1}
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Goal / corpus / bucket name" required error={errors[`bucketList.${index}.name`]}>
              <input
                list="growvest-goal-options"
                className={inputClassName}
                value={goal.name || ""}
                onChange={(event) => onChange(index, "name", event.target.value)}
                placeholder="Example: Retirement at 55"
                disabled={disabled}
              />
            </Field>
            <Field label="Target amount (INR)" required error={errors[`bucketList.${index}.targetAmount`]}>
              <input className={inputClassName} type="number" min="0" value={goal.targetAmount ?? ""} onChange={(event) => onChange(index, "targetAmount", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Current amount (INR)" error={errors[`bucketList.${index}.currentAmount`]}>
              <input className={inputClassName} type="number" min="0" value={goal.currentAmount ?? ""} onChange={(event) => onChange(index, "currentAmount", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Timeline" required error={errors[`bucketList.${index}.timeline`]} hint="Example: 10 years or by 2036">
              <input className={inputClassName} value={goal.timeline || ""} onChange={(event) => onChange(index, "timeline", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Target year" error={errors[`bucketList.${index}.targetYear`]}>
              <input className={inputClassName} type="number" min="2026" max="2100" value={goal.targetYear ?? ""} onChange={(event) => onChange(index, "targetYear", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Monthly contribution (INR)" error={errors[`bucketList.${index}.monthlyContribution`]}>
              <input className={inputClassName} type="number" min="0" value={goal.monthlyContribution ?? ""} onChange={(event) => onChange(index, "monthlyContribution", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Priority">
              <select className={inputClassName} value={goal.priority || "Medium"} onChange={(event) => onChange(index, "priority", event.target.value)} disabled={disabled}>
                {GOAL_PRIORITIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Goal type">
              <select className={inputClassName} value={goal.type || "Flexible"} onChange={(event) => onChange(index, "type", event.target.value)} disabled={disabled}>
                {GOAL_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClassName} value={goal.status || "Planning"} onChange={(event) => onChange(index, "status", event.target.value)} disabled={disabled}>
                {GOAL_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
            <Field label="Primary goal" error={errors[`bucketList.${index}.isPrimary`]}>
              <button
                type="button"
                onClick={() => onSetPrimary(index)}
                disabled={disabled}
                className={`min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm font-bold transition ${goal.isPrimary ? "border-blue-600 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {goal.isPrimary ? "Primary goal selected" : "Set as primary goal"}
              </button>
            </Field>
            <Field label="Goal notes">
              <textarea className={`${inputClassName} min-h-24 resize-y`} value={goal.notes || ""} onChange={(event) => onChange(index, "notes", event.target.value)} disabled={disabled} placeholder="Specific context, beneficiaries, flexibility or constraints" />
            </Field>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={onAdd} disabled={disabled} className="w-fit">
        <Plus size={17} /> Add another goal
      </Button>
    </div>
  );
}



export function SurplusAllocationEditor({ rows, monthlySurplus = 0, errors = {}, disabled = false, onAdd, onRemove, onChange }) {
  const available = Math.max(0, Number(monthlySurplus || 0));
  const calculated = (item) => item.mode === "percentage" ? available * Number(item.percentage || 0) / 100 : Number(item.fixedAmount || 0);
  const total = rows.reduce((sum, item) => sum + calculated(item), 0);
  const unallocated = available - total;

  return (
    <div className="grid gap-4">
      <div className={`rounded-xl border p-4 ${unallocated < -0.01 ? "border-red-200 bg-red-50" : unallocated > 0.01 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Monthly surplus</p><p className="mt-1 font-black text-slate-950">{formatCurrency(available)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Allocated</p><p className="mt-1 font-black text-slate-950">{formatCurrency(total)}</p></div><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Unallocated</p><p className={`mt-1 font-black ${unallocated < -0.01 ? "text-red-700" : unallocated > 0.01 ? "text-amber-700" : "text-emerald-700"}`}>{formatCurrency(unallocated)}</p></div></div>
        {unallocated < -0.01 ? <p className="mt-2 text-xs font-semibold text-red-700">Allocation exceeds available surplus by {formatCurrency(Math.abs(unallocated))}.</p> : unallocated > 0.01 ? <p className="mt-2 text-xs font-semibold text-amber-800">{formatCurrency(unallocated)} of monthly surplus is still unallocated.</p> : <p className="mt-2 text-xs font-semibold text-emerald-800">Monthly surplus is fully allocated.</p>}
      </div>
      {rows.length ? rows.map((item, index) => (
        <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-white p-5">
          <RowHeader title={`Allocation ${index + 1}`} badge={calculated(item) ? formatCurrency(calculated(item)) : "Not allocated"} onRemove={() => onRemove(index)} disabled={disabled} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Allocation purpose" error={errors[`surplusAllocations.${index}.category`]}>
              <select className={inputClassName} value={item.category || ""} onChange={(event) => onChange(index, "category", event.target.value)} disabled={disabled}><option value="">Select purpose</option>{SURPLUS_ALLOCATION_TYPES.map((value) => <option key={value}>{value}</option>)}</select>
            </Field>
            <Field label="Allocation method">
              <select className={inputClassName} value={item.mode || "fixed"} onChange={(event) => onChange(index, "mode", event.target.value)} disabled={disabled}><option value="fixed">Fixed amount</option><option value="percentage">Percentage of surplus</option></select>
            </Field>
            {item.mode === "percentage" ? <Field label="Percentage of surplus" error={errors[`surplusAllocations.${index}.percentage`]}><div className="relative"><input className={`${inputClassName} pr-10`} type="number" min="0" max="100" step="0.1" value={item.percentage ?? ""} onChange={(event) => onChange(index, "percentage", event.target.value)} disabled={disabled} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">%</span></div></Field> : <Field label="Fixed amount (INR)"><input className={inputClassName} type="number" min="0" value={item.fixedAmount ?? ""} onChange={(event) => onChange(index, "fixedAmount", event.target.value)} disabled={disabled} /></Field>}
            <Field label="Calculated allocation"><input className={`${inputClassName} bg-slate-50 font-bold`} value={formatCurrency(calculated(item))} readOnly /></Field>
            <div className="md:col-span-2 xl:col-span-4"><Field label="Notes"><input className={inputClassName} value={item.notes || ""} onChange={(event) => onChange(index, "notes", event.target.value)} disabled={disabled} placeholder="Optional instruction or purpose" /></Field></div>
          </div>
        </div>
      )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No monthly surplus allocation plan added.</div>}
      <Button type="button" variant="secondary" onClick={onAdd} disabled={disabled} className="w-fit"><Plus size={17} /> Add surplus allocation</Button>
    </div>
  );
}

export function ExistingInvestmentsEditor({ rows, errors = {}, disabled = false, onAdd, onRemove, onChange }) {
  return (
    <div className="grid gap-4">
      {rows.length ? rows.map((item, index) => (
        <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-white p-5">
          <RowHeader title={`Investment ${index + 1}`} onRemove={() => onRemove(index)} disabled={disabled} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Investment type" error={errors[`existingInvestments.${index}.type`]}>
              <select className={inputClassName} value={item.type || ""} onChange={(event) => onChange(index, "type", event.target.value)} disabled={disabled}>
                <option value="">Select type</option>
                {EXISTING_INVESTMENT_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Fund / institution">
              <input className={inputClassName} value={item.institution || ""} onChange={(event) => onChange(index, "institution", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Current value (INR)">
              <input className={inputClassName} type="number" min="0" value={item.currentValue ?? ""} onChange={(event) => onChange(index, "currentValue", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Monthly contribution (INR)">
              <input className={inputClassName} type="number" min="0" value={item.monthlyContribution ?? ""} onChange={(event) => onChange(index, "monthlyContribution", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Start date">
              <input className={inputClassName} type="date" value={item.startDate || ""} onChange={(event) => onChange(index, "startDate", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Maturity date">
              <input className={inputClassName} type="date" value={item.maturityDate || ""} onChange={(event) => onChange(index, "maturityDate", event.target.value)} disabled={disabled} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <input className={inputClassName} value={item.notes || ""} onChange={(event) => onChange(index, "notes", event.target.value)} disabled={disabled} />
              </Field>
            </div>
          </div>
        </div>
      )) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No existing investments added.</div>
      )}
      <Button type="button" variant="secondary" onClick={onAdd} disabled={disabled} className="w-fit">
        <Plus size={17} /> Add investment
      </Button>
    </div>
  );
}

export function LiabilitiesEditor({ rows, errors = {}, disabled = false, onAdd, onRemove, onChange }) {
  return (
    <div className="grid gap-4">
      {rows.length ? rows.map((item, index) => (
        <div key={item.id || index} className="rounded-2xl border border-slate-200 bg-white p-5">
          <RowHeader title={`Liability ${index + 1}`} onRemove={() => onRemove(index)} disabled={disabled} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Liability type" error={errors[`liabilities.${index}.type`]}>
              <select className={inputClassName} value={item.type || ""} onChange={(event) => onChange(index, "type", event.target.value)} disabled={disabled}>
                <option value="">Select type</option>
                {LIABILITY_TYPES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Lender">
              <input className={inputClassName} value={item.lender || ""} onChange={(event) => onChange(index, "lender", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Original loan amount (INR)">
              <input className={inputClassName} type="number" min="0" value={item.originalLoanAmount ?? ""} onChange={(event) => onChange(index, "originalLoanAmount", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Outstanding amount (INR)">
              <input className={inputClassName} type="number" min="0" value={item.outstandingAmount ?? ""} onChange={(event) => onChange(index, "outstandingAmount", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="EMI amount (INR)">
              <input className={inputClassName} type="number" min="0" value={item.emiAmount ?? ""} onChange={(event) => onChange(index, "emiAmount", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Interest rate (%)">
              <input className={inputClassName} type="number" min="0" step="0.01" value={item.interestRate ?? ""} onChange={(event) => onChange(index, "interestRate", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Remaining tenure">
              <input className={inputClassName} value={item.remainingTenure || ""} onChange={(event) => onChange(index, "remainingTenure", event.target.value)} disabled={disabled} placeholder="Example: 7 years" />
            </Field>
            <Field label="Extra repayment / prepayment (INR)">
              <input className={inputClassName} type="number" min="0" value={item.extraRepayment ?? ""} onChange={(event) => onChange(index, "extraRepayment", event.target.value)} disabled={disabled} />
            </Field>
            <Field label="Target closure date">
              <input className={inputClassName} type="date" value={item.targetClosureDate || ""} onChange={(event) => onChange(index, "targetClosureDate", event.target.value)} disabled={disabled} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes">
                <input className={inputClassName} value={item.notes || ""} onChange={(event) => onChange(index, "notes", event.target.value)} disabled={disabled} />
              </Field>
            </div>
          </div>
        </div>
      )) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No active liabilities added.</div>
      )}
      <Button type="button" variant="secondary" onClick={onAdd} disabled={disabled} className="w-fit">
        <Plus size={17} /> Add liability
      </Button>
    </div>
  );
}
