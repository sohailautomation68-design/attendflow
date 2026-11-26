"use client";

import { useRef, useState, useTransition } from "react";
import { addSubjectAction, deleteSubjectAction } from "@/app/actions";

export function SubjectsAdmin({ classId, subjects }: { classId: string; subjects: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      {msg && <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{msg}</p>}
      <ul className="divide-y divide-slate-100">
        {subjects.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2 text-sm">
            <span>{s.name}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                const r = await deleteSubjectAction(s.id, classId);
                setMsg(r.error ?? r.ok ?? null);
              })}
              className="h-9 rounded-lg px-3 font-medium text-rose-700 hover:bg-rose-50"
            >
              Remove
            </button>
          </li>
        ))}
        {subjects.length === 0 && <li className="py-2 text-sm text-slate-500">No subjects yet.</li>}
      </ul>
      <form
        className="flex gap-2"
        action={(fd) => {
          const name = String(fd.get("name") ?? "");
          start(async () => {
            const r = await addSubjectAction(classId, name);
            setMsg(r.error ?? r.ok ?? null);
            if (r.ok && input.current) input.current.value = "";
          });
        }}
      >
        <input ref={input} name="name" required minLength={2} maxLength={60} placeholder="e.g. Mathematics" className="h-11 flex-1 rounded-lg border border-slate-300 px-3" aria-label="Subject name" />
        <button type="submit" disabled={pending} className="h-11 rounded-lg bg-indigo-600 px-4 font-semibold text-white disabled:opacity-50">Add</button>
      </form>
    </div>
  );
}
