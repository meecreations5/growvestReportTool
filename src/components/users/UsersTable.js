"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Pencil, Search, UserRoundPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS, USER_ROLES } from "@/lib/constants/roles";
import { cancelStaffInvitation, setStaffUserStatus, subscribeStaffInvitations, subscribeStaffUsers } from "@/services/userService";
import { formatDateTime } from "@/lib/utils/date";
import { inputClassName } from "@/components/ui/Field";
import UserStatusBadge from "./UserStatusBadge";

export default function UsersTable() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const canManage = profile?.role === USER_ROLES.SUPER_ADMIN;

  useEffect(() => {
    const unsubscribeUsers = subscribeStaffUsers(
      (items) => { setUsers(items); setLoadingUsers(false); },
      (err) => { console.error(err); setError("Unable to load staff users."); setLoadingUsers(false); }
    );
    const unsubscribeInvitations = subscribeStaffInvitations(
      (items) => { setInvitations(items); setLoadingInvitations(false); },
      (err) => { console.error(err); setError("Unable to load pending staff access."); setLoadingInvitations(false); }
    );
    return () => { unsubscribeUsers?.(); unsubscribeInvitations?.(); };
  }, []);

  const records = useMemo(() => {
    const linkedEmails = new Set(users.map((item) => String(item.email || "").toLowerCase()));
    const pending = invitations.filter((item) => item.status !== "linked" && !linkedEmails.has(String(item.email || "").toLowerCase()));
    return [...users, ...pending];
  }, [users, invitations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((item) => {
      const matchesSearch = !term || [item.fullName, item.email, item.designation, item.advisorCode].some((value) => String(value || "").toLowerCase().includes(term));
      return matchesSearch && (role === "all" || item.role === role);
    });
  }, [records, role, search]);

  async function toggleUser(user) {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    setWorkingId(user.id);
    setError("");
    try {
      await setStaffUserStatus(user, nextStatus, profile);
    } catch (err) {
      setError(err.message || "Unable to update access status.");
    } finally {
      setWorkingId("");
    }
  }

  async function cancelInvitation(invitation) {
    setWorkingId(invitation.id);
    setError("");
    try {
      await cancelStaffInvitation(invitation, profile);
    } catch (err) {
      setError(err.message || "Unable to cancel invitation.");
    } finally {
      setWorkingId("");
    }
  }

  if (loadingUsers || loadingInvitations) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading users and access invitations…</div>;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {error ? <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-700">{error}</div> : null}
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClassName} pl-10`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, designation or advisor code" />
        </div>
        <select className={inputClassName} value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="all">All staff roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="advisor">Advisor</option>
        </select>
      </div>

      <div className="gv-scrollbar overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-bold">User</th>
              <th className="px-5 py-3 font-bold">Role</th>
              <th className="px-5 py-3 font-bold">Designation</th>
              <th className="px-5 py-3 font-bold">Advisor code</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold">Last login</th>
              <th className="px-5 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const invitation = item.recordState === "invitation";
              return (
                <tr key={`${item.recordState}-${item.id}`} className="transition hover:bg-slate-50/80">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-950">{item.fullName}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.email}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-700">{ROLE_LABELS[item.role] || item.role}</td>
                  <td className="px-5 py-4 text-slate-700">{item.designation || "—"}</td>
                  <td className="px-5 py-4 text-slate-700">{item.advisorCode || "—"}</td>
                  <td className="px-5 py-4"><UserStatusBadge status={item.status} invitationStatus={invitation ? item.status : null} /></td>
                  <td className="px-5 py-4 text-slate-600">{invitation ? "Not signed in" : formatDateTime(item.lastLoginAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!invitation && canManage ? (
                        <Link href={`/users/${item.id}/edit`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" aria-label={`Edit ${item.fullName}`}><Pencil size={16} /></Link>
                      ) : null}
                      {!invitation && canManage ? (
                        <button disabled={workingId === item.id} onClick={() => toggleUser(item)} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition disabled:opacity-50 ${item.status === "active" ? "border-red-200 text-red-600 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`} aria-label={item.status === "active" ? `Deactivate ${item.fullName}` : `Activate ${item.fullName}`}>
                          {item.status === "active" ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                        </button>
                      ) : null}
                      {invitation && canManage && item.status === "pending" ? (
                        <button disabled={workingId === item.id} onClick={() => cancelInvitation(item)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"><Ban size={15} /> Cancel</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-slate-500">No staff users match the selected filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs font-medium text-slate-500">
        <span>{filtered.length} staff access record{filtered.length === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-1"><UserRoundPlus size={14} /> Microsoft accounts link on first sign-in</span>
      </div>
    </div>
  );
}
