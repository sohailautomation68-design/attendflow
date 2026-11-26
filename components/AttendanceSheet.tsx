"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveAttendanceAction } from "@/app/actions";

type Status = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

const OPTIONS: { value: Status; label: string; short: string; on: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", on: "bg-emerald-600 text-white" },
  { value: "ABSENT", label: "Absent", short: "A", on: "bg-rose-600 text-white" },
  { value: "LATE", label: "Late", short: "L", on: "bg-amber-500 text-white" },
  { value: "LEAVE", label: "Leave", short: "Lv", on: "bg-sky-600 text-white" },
];

type Student = { id: string; fullName: string; rollNumber: string; status: Status | null };

/**
 * Mobile-first attendance sheet.
 * - One tap per student, big buttons.
 * - "Mark all present" for the common case.
 * - Draft is kept in this browser so a lost connection never loses marks.
 * - The server re-checks every ID and the teacher's access on save.
 */
export function AttendanceSheet({
  classId,
  className,
  date,
  subjectId = "",
  students,
}: {
  classId: string;
  className: string;
  date: string;
  subjectId?: string;
  students: Student[];
}) {
  const draftKey = `attendflow-draft:${classId}:${date}:${subjectId}`;

  // Start from what is saved on the server.
  const serverState = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, s.status])) as Record<string, Status | null>,
    [students],
  );

  const [marks, setMarks] = useState<Record<string, Status | null>>(serverState);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore an unsaved draft (only if it is newer than what the server has).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, Status | null>;
        const hasChanges = Object.keys(draft).some((id) => draft[id] !== serverState[id]);
        if (hasChanges) {
          setMarks({ ...serverState, ...draft });
          setDraftRestored(true);
        }
      }
    } catch {
      // Storage unavailable (private mode) — the sheet still works without a draft.
    }
  }, [draftKey, serverState]);

  // Persist the draft from the change handlers (not an effect, so the
  // restore above can never be overwritten by the initial server state).
  function persistDraft(next: Record<string, Status | null>) {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, unmarked: 0 };
    for (const s of students) {
      const v = marks[s.id];
      if (v) c[v]++;
      else c.unmarked++;
    }
    return c;
  }, [marks, students]);

  function setStatus(id: string, status: Status) {
    const next = { ...marks, [id]: marks[id] === status ? null : status };
    setMarks(next);
    persistDraft(next);
  }

  function markAllPresent() {
    const next = { ...marks };
    for (const s of students) if (!next[s.id]) next[s.id] = "PRESENT";
    setMarks(next);
    persistDraft(next);
  }

  function save() {
    const entries = students
      .filter((s) => marks[s.id])
      .map((s) => ({ studentId: s.id, status: marks[s.id] as Status }));

    if (entries.length === 0) {
      setMessage({ kind: "error", text: "Mark at least one student before saving." });
      return;
    }

    setMessage(null);
    startSaving(async () => {
      const payload = { classId, date, subjectId, entries };
      let result = await saveAttendanceAction(payload);
      if (result && "needsReason" in result) {
        // Admin changing a sheet after the 48h window: a reason is required and is recorded in the audit log.
        const reason = window.prompt("This sheet was submitted more than 48 hours ago. Reason for the change (required):");
        if (!reason || !reason.trim()) {
          setMessage({ kind: "error", text: "Change not saved: a reason is required after 48 hours." });
          return;
        }
        result = await saveAttendanceAction(payload, reason.trim());
      }
      if (result && "ok" in result && result.ok) {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
        setDraftRestored(false);
        setMessage({
          kind: "ok",
          text: `${result.ok}. ${counts.unmarked ? `${counts.unmarked} still unmarked.` : "All marked."}`,
        });
      } else {
        // Keep the draft on screen so nothing is lost; the teacher can retry.
        setMessage({ kind: "error", text: result?.error ?? "Could not save. Your marks are kept — tap Save again." });
      }
    });
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-10 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-slate-900">{className}</h1>
        <p className="text-sm text-slate-600">
          {date} · <span className="font-medium text-emerald-700">{counts.PRESENT} P</span> ·{" "}
          <span className="font-medium text-rose-700">{counts.ABSENT} A</span> ·{" "}
          <span className="font-medium text-amber-700">{counts.LATE} L</span> ·{" "}
          <span className="font-medium text-sky-700">{counts.LEAVE} Lv</span> ·{" "}
          <span className="text-slate-500">{counts.unmarked} unmarked</span>
        </p>
        <button
          type="button"
          onClick={markAllPresent}
          disabled={counts.unmarked === 0 || isSaving}
          className="mt-2 h-11 w-full rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 disabled:opacity-50"
        >
          Mark all unmarked as Present
        </button>
        {draftRestored && (
          <p className="mt-2 text-xs text-amber-700">Restored your unsaved marks from this device.</p>
        )}
      </div>

      {students.length === 0 ? (
        <p className="mt-6 text-center text-slate-600">No students in this class yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {students.map((s) => (
            <li key={s.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-base font-semibold text-slate-900">{s.fullName}</span>
                <span className="shrink-0 text-xs text-slate-500">Roll {s.rollNumber}</span>
              </div>
              <div role="group" aria-label={`Attendance for ${s.fullName}`} className="grid grid-cols-4 gap-2">
                {OPTIONS.map((o) => {
                  const active = marks[s.id] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatus(s.id, o.value)}
                      disabled={isSaving}
                      className={`h-12 rounded-xl text-sm font-semibold transition active:scale-95 ${
                        active ? o.on : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <span className="sm:hidden">{o.short}</span>
                      <span className="hidden sm:inline">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {message && (
          <p
            role="status"
            className={`mb-2 rounded-lg px-3 py-2 text-sm ${
              message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </p>
        )}
        <button
          type="button"
          onClick={save}
          disabled={isSaving || students.length === 0}
          className="h-14 w-full rounded-2xl bg-indigo-600 text-lg font-bold text-white active:scale-[0.99] disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save attendance"}
        </button>
      </div>
    </div>
  );
}
