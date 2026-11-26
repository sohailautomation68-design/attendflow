"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createPortalAccountAction,
  decideCorrectionAction,
  markAllReadAction,
  requestCorrectionAction,
} from "@/app/actions";
import { ATTENDANCE_STATUSES } from "@/lib/data-constants";

const STATUS_LABEL: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", LEAVE: "Excused" };

/** Student or guardian asks for one past mark to be corrected. */
export function CorrectionForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(requestCorrectionAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input type="hidden" name="studentId" value={studentId} />
      <label className="text-sm">
        <span className="block text-slate-600">Date</span>
        <input type="date" name="date" required className="h-11 w-full rounded-lg border border-slate-300 px-2" />
      </label>
      <label className="text-sm">
        <span className="block text-slate-600">Correct status</span>
        <select name="requestedStatus" required className="h-11 w-full rounded-lg border border-slate-300 px-2">
          {ATTENDANCE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-600">Why (for the admin)</span>
        <input name="reason" required minLength={5} maxLength={300} className="h-11 w-full rounded-lg border border-slate-300 px-3" />
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50 sm:col-span-2">
        {pending ? "Sending…" : "Send request"}
      </button>
      {state?.error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-700 sm:col-span-2">{state.ok}</p>}
    </form>
  );
}

/** Admin approves or declines a correction request. */
export function CorrectionDecision({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-9 rounded-lg border border-slate-300 px-2 text-sm" aria-label="Decision note" />
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await decideCorrectionAction(requestId, true, note); setMsg(r.error ?? r.ok ?? null); })} className="h-9 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await decideCorrectionAction(requestId, false, note); setMsg(r.error ?? r.ok ?? null); })} className="h-9 rounded-lg bg-slate-200 px-3 text-sm font-semibold text-slate-800 disabled:opacity-50">Decline</button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}

/** Admin creates a student or guardian login linked to this student. */
export function PortalAccountForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(createPortalAccountAction, undefined);
  return (
    <form action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input type="hidden" name="studentId" value={studentId} />
      <select name="role" required className="h-11 rounded-lg border border-slate-300 px-2" aria-label="Account type">
        <option value="STUDENT">Student login</option>
        <option value="GUARDIAN">Guardian login</option>
      </select>
      <input name="name" required placeholder="Full name" className="h-11 rounded-lg border border-slate-300 px-3" />
      <input name="email" type="email" required placeholder="Email" className="h-11 rounded-lg border border-slate-300 px-3" />
      <input name="password" type="password" required minLength={8} placeholder="Temporary password (8+)" className="h-11 rounded-lg border border-slate-300 px-3" />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" value="yes" />
        Guardian consent recorded (required for guardian logins)
      </label>
      <button type="submit" disabled={pending} className="h-11 rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50 sm:col-span-2">
        {pending ? "Creating…" : "Create login"}
      </button>
      {state?.error && <p role="alert" className="text-sm text-rose-700 sm:col-span-2">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-emerald-700 sm:col-span-2">{state.ok}</p>}
    </form>
  );
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await markAllReadAction(); })} className="h-10 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-800 disabled:opacity-50">
      Mark all as read
    </button>
  );
}
