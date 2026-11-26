"use client";

import { useState, useTransition } from "react";
import { addFollowUpAction, completeFollowUpAction, resolveAlertAction } from "@/app/actions";

const REASONS = ["Sickness", "Family issue", "Transportation problem", "Personal reason", "Unspecified", "Other"];

type Task = { id: string; status: string; dueDate: string; assignedToId: string; reason: string | null; notes: string | null };

export function AlertActions({
  alertId,
  tasks,
  teachers,
  isAdmin,
  currentUserId,
}: {
  alertId: string;
  tasks: Task[];
  teachers: { id: string; name: string }[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [assignee, setAssignee] = useState(teachers[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});

  const show = (r: { ok?: string; error?: string } | undefined) => setMsg(r?.error ?? r?.ok ?? null);
  const openTasks = tasks.filter((t) => t.status === "OPEN");

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-sm">
      {msg && <p role="status" className="rounded-lg bg-slate-100 px-3 py-2">{msg}</p>}

      {openTasks.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <span>Follow-up due {t.dueDate}{t.notes ? ` · ${t.notes}` : ""}</span>
          {(isAdmin || t.assignedToId === currentUserId) && (
            <>
              <select
                value={reason[t.id] ?? ""}
                onChange={(e) => setReason({ ...reason, [t.id]: e.target.value })}
                className="h-9 rounded-lg border border-slate-300 px-2"
                aria-label="Reason given"
              >
                <option value="">Reason (if given)</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => show(await completeFollowUpAction(t.id, reason[t.id] ?? "", "")))}
                className="h-9 rounded-lg bg-emerald-600 px-3 font-semibold text-white disabled:opacity-50"
              >
                Mark done
              </button>
            </>
          )}
        </div>
      ))}

      {isAdmin && teachers.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-2 sm:col-span-2" aria-label="Assign to">
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-2" aria-label="Due date" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (e.g. call father)" className="h-10 rounded-lg border border-slate-300 px-2" aria-label="Follow-up note" />
          <button
            type="button"
            disabled={pending || !due || !assignee}
            onClick={() => start(async () => show(await addFollowUpAction(alertId, assignee, due, notes)))}
            className="h-10 rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50"
          >
            Assign follow-up
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => show(await resolveAlertAction(alertId)))}
        className="h-10 rounded-lg bg-slate-800 px-4 font-semibold text-white disabled:opacity-50"
      >
        Resolve alert
      </button>
    </div>
  );
}
