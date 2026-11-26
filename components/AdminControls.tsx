"use client";

import { useState, useTransition } from "react";
import { assignTeacherAction, deactivateStudentAction, transferStudentAction } from "@/app/actions";

export function RemoveStudentButton({ studentId, classId, name }: { studentId: string; classId: string; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Remove ${name} from this class? Their past attendance is kept.`)) return;
          start(async () => {
            const r = await deactivateStudentAction(studentId, classId);
            setMsg(r && "error" in r && r.error ? r.error : "Removed");
          });
        }}
        className="h-9 rounded-lg px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}

export function TeacherSelect({
  classId,
  teachers,
  currentTeacherId,
}: {
  classId: string;
  teachers: { id: string; name: string }[];
  currentTeacherId: string | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={currentTeacherId ?? ""}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await assignTeacherAction(classId, e.target.value);
            setMsg(r && "error" in r && r.error ? r.error : "Saved");
          })
        }
        className="h-11 min-w-56 rounded-lg border border-slate-300 px-3"
        aria-label="Assigned teacher"
      >
        <option value="">No teacher assigned</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {msg && <span className="text-sm text-slate-500">{msg}</span>}
    </div>
  );
}

export function TransferButton({
  studentId,
  classId,
  classes,
}: {
  studentId: string;
  classId: string;
  classes: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const options = classes.filter((c) => c.id !== classId);
  if (options.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <select
        defaultValue=""
        disabled={pending}
        aria-label="Move student to another class"
        onChange={(e) => {
          const to = e.target.value;
          if (!to) return;
          start(async () => {
            const r = await transferStudentAction(studentId, to, classId);
            setMsg(r && "error" in r && r.error ? r.error : "Moved");
          });
        }}
        className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
      >
        <option value="">Move to…</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
