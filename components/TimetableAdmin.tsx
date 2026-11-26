"use client";

import { useState, useTransition } from "react";
import { addTimetableAction, cancelDayAction, deleteTimetableAction, generateSessionsAction, restoreDayAction } from "@/app/actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Entry = { id: string; weekday: number; startTime: string; endTime: string };
type Cancelled = { date: string; reason: string | null };

export function TimetableAdmin({
  classId,
  entries,
  cancelledDays,
}: {
  classId: string;
  entries: Entry[];
  cancelledDays: Cancelled[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [cancelDate, setCancelDate] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [genFrom, setGenFrom] = useState("");
  const [genTo, setGenTo] = useState("");

  const show = (r: { ok?: string; error?: string } | undefined) => setMsg(r?.error ?? r?.ok ?? null);

  return (
    <div className="space-y-6">
      {msg && <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{msg}</p>}

      <div>
        <h3 className="mb-2 font-semibold text-slate-900">Weekly slots</h3>
        <ul className="mb-3 divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2 text-sm">
              <span>{DAYS[e.weekday]} · {e.startTime}–{e.endTime}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => show(await deleteTimetableAction(e.id, classId)))}
                className="h-9 rounded-lg px-3 font-medium text-rose-700 hover:bg-rose-50"
              >
                Remove
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="py-2 text-sm text-slate-500">No weekly slots yet.</li>}
        </ul>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="h-11 rounded-lg border border-slate-300 px-2" aria-label="Weekday">
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-2" aria-label="Start time" />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-2" aria-label="End time" />
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => show(await addTimetableAction(classId, weekday, startTime, endTime)))}
            className="h-11 rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50"
          >
            Add slot
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-slate-900">Cancelled or holiday days</h3>
        <ul className="mb-3 divide-y divide-slate-100">
          {cancelledDays.map((c) => (
            <li key={c.date} className="flex items-center justify-between py-2 text-sm">
              <span>{c.date}{c.reason ? ` · ${c.reason}` : ""}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => show(await restoreDayAction(classId, c.date)))}
                className="h-9 rounded-lg px-3 font-medium text-slate-700 hover:bg-slate-100"
              >
                Restore
              </button>
            </li>
          ))}
          {cancelledDays.length === 0 && <li className="py-2 text-sm text-slate-500">None.</li>}
        </ul>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-2" aria-label="Day to cancel" />
          <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason (e.g. Eid holiday)" className="h-11 rounded-lg border border-slate-300 px-3 sm:col-span-2" aria-label="Reason" />
          <button
            type="button"
            disabled={pending || !cancelDate}
            onClick={() => start(async () => show(await cancelDayAction(classId, cancelDate, cancelReason)))}
            className="h-11 rounded-lg bg-slate-800 font-semibold text-white disabled:opacity-50"
          >
            Cancel day
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-slate-900">Create attendance days from the timetable</h3>
        <p className="mb-2 text-sm text-slate-600">Creates an empty day for each timetable slot in the range. Cancelled days are skipped. Teachers then mark each day.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input type="date" value={genFrom} onChange={(e) => setGenFrom(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-2" aria-label="From date" />
          <input type="date" value={genTo} onChange={(e) => setGenTo(e.target.value)} className="h-11 rounded-lg border border-slate-300 px-2" aria-label="To date" />
          <button
            type="button"
            disabled={pending || !genFrom || !genTo}
            onClick={() => start(async () => show(await generateSessionsAction(classId, genFrom, genTo)))}
            className="h-11 rounded-lg bg-slate-800 font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            Create days
          </button>
        </div>
      </div>
    </div>
  );
}
