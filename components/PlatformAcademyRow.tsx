"use client";

import { useState, useTransition } from "react";
import { updateAcademyBillingAction } from "@/app/actions";

export function PlatformAcademyRow(props: {
  academyId: string;
  name: string;
  students: number;
  teachers: number;
  planCode: string;
  subscriptionStatus: string;
  active: boolean;
  plans: { code: string; name: string; maxStudents: number; maxTeachers: number }[];
}) {
  const [plan, setPlan] = useState(props.planCode);
  const [status, setStatus] = useState(props.subscriptionStatus);
  const [active, setActive] = useState(props.active);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = props.plans.find((p) => p.code === plan);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-slate-900">{props.name}</p>
        <p className="text-sm text-slate-600">
          {props.students} / {current?.maxStudents ?? "?"} students · {props.teachers} / {current?.maxTeachers ?? "?"} teachers
        </p>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-2" aria-label="Plan">
          {props.plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-2" aria-label="Subscription status">
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Account enabled
        </label>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for change" className="h-10 rounded-lg border border-slate-300 px-2" aria-label="Reason" />
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await updateAcademyBillingAction(props.academyId, { planCode: plan, subscriptionStatus: status, active, reason });
            setMsg(r.error ?? r.ok ?? null);
          })}
          className="h-10 rounded-lg bg-indigo-600 font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {msg && <p role="status" className="mt-2 text-sm text-slate-700">{msg}</p>}
    </div>
  );
}
