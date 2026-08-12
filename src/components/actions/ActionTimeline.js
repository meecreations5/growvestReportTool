"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils/date";
import { subscribeActionEvents } from "@/services/actionService";

export default function ActionTimeline({ actionId }) {
  const { profile } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!actionId || !profile) return undefined;
    return subscribeActionEvents(actionId, profile, setEvents, () => setEvents([]));
  }, [actionId, profile]);

  return <div className="grid gap-2">{events.length ? events.map((event) => <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-700">{event.createdByName || "GrowVest"}</p><p className="text-[10px] text-slate-400">{formatDateTime(event.createdAt)}</p></div><p className="mt-1 text-xs text-slate-500">{event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus ? `${event.fromStatus} → ${event.toStatus}` : String(event.eventType || "Update").replaceAll("_", " ")}</p>{event.note ? <p className="mt-2 text-sm leading-6 text-slate-700">{event.note}</p> : null}</div>) : <p className="inline-flex items-center gap-2 text-xs text-slate-400"><Clock3 size={14} /> No timeline updates yet.</p>}</div>;
}
