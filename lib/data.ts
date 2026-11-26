import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import { isValidISODate, todayISO } from "@/lib/dates";
import { studentStats, type StatSession } from "@/lib/attendance-stats";

/*
 * TENANT-SCOPED DATA ACCESS
 * ---------------------------------------------------------------
 * Every function here takes the logged-in CurrentUser (from the session),
 * never an academyId from the browser. Every query filters by
 * user.academyId. Teachers can only touch classes they teach.
 * Violations throw NotFound-style errors (we do not reveal that a
 * record exists in another academy).
 */

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export class AccessError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "AccessError";
  }
}

/** Returns the class only if the user is allowed to see it. */
async function assertClassAccess(user: CurrentUser, classId: string) {
  // Only staff can see classes. Students and guardians use their own read-only views.
  if (user.role !== "ADMIN" && user.role !== "TEACHER") throw new AccessError();
  const cls = await db.class.findFirst({
    where: {
      id: classId,
      academyId: user.academyId,
      ...(user.role === "TEACHER" ? { teacherId: user.id } : {}),
    },
  });
  if (!cls) throw new AccessError();
  return cls;
}

/* ---------- Classes ---------- */

export async function listClasses(user: CurrentUser) {
  if (user.role !== "ADMIN" && user.role !== "TEACHER") return [];
  return db.class.findMany({
    where: {
      academyId: user.academyId,
      ...(user.role === "TEACHER" ? { teacherId: user.id } : {}),
    },
    include: {
      teacher: { select: { name: true } },
      _count: { select: { students: { where: { active: true } } } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getClass(user: CurrentUser, classId: string) {
  return assertClassAccess(user, classId);
}

export async function createClass(
  user: CurrentUser,
  input: { name: string; subject?: string; teacherId?: string | null },
) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can create classes");
  if (input.teacherId) await assertTeacherInAcademy(user, input.teacherId);
  return db.class.create({
    data: {
      academyId: user.academyId,
      name: input.name,
      subject: input.subject || null,
      teacherId: input.teacherId || null,
    },
  });
}

export async function assignTeacher(user: CurrentUser, classId: string, teacherId: string | null) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can assign teachers");
  await assertClassAccess(user, classId);
  if (teacherId) await assertTeacherInAcademy(user, teacherId);
  return db.class.update({ where: { id: classId }, data: { teacherId } });
}

/* ---------- Teachers ---------- */

async function assertTeacherInAcademy(user: CurrentUser, teacherId: string) {
  const teacher = await db.user.findFirst({
    where: { id: teacherId, academyId: user.academyId, role: "TEACHER", active: true },
  });
  if (!teacher) throw new AccessError("Teacher not found in your academy");
}

export async function listTeachers(user: CurrentUser) {
  return db.user.findMany({
    where: { academyId: user.academyId, role: "TEACHER" },
    select: { id: true, name: true, email: true, active: true },
    orderBy: { name: "asc" },
  });
}

/* ---------- Students ---------- */

export async function listStudents(user: CurrentUser, classId: string) {
  await assertClassAccess(user, classId);
  return db.student.findMany({
    where: { classId, academyId: user.academyId, active: true },
    orderBy: { rollNumber: "asc" },
  });
}

export async function addStudent(
  user: CurrentUser,
  classId: string,
  input: { fullName: string; rollNumber: string; guardianPhone?: string },
) {
  await assertClassAccess(user, classId);
  await assertWithinPlan(user.academyId, "student");
  return db.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: {
        academyId: user.academyId,
        classId,
        fullName: input.fullName,
        rollNumber: input.rollNumber,
        guardianPhone: input.guardianPhone || null,
      },
    });
    await tx.enrollment.create({
      data: {
        academyId: user.academyId,
        studentId: student.id,
        classId,
        startDate: todayISO(),
      },
    });
    return student;
  });
}

/**
 * Moves a student to another class (admin only). The old enrollment is closed
 * and a new one opened, so previous attendance stays linked to the old class.
 */
export async function transferStudent(
  user: CurrentUser,
  studentId: string,
  toClassId: string,
  effectiveDate: string = todayISO(),
) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can transfer students");
  if (!isValidISODate(effectiveDate)) throw new AccessError("Invalid date");

  const student = await db.student.findFirst({
    where: { id: studentId, academyId: user.academyId, active: true },
  });
  if (!student) throw new AccessError();
  if (student.classId === toClassId) throw new AccessError("Student is already in that class");
  await assertClassAccess(user, toClassId);

  return db.$transaction(async (tx) => {
    await tx.enrollment.updateMany({
      where: { studentId, academyId: user.academyId, endDate: null },
      data: { endDate: effectiveDate },
    });
    await tx.enrollment.create({
      data: { academyId: user.academyId, studentId, classId: toClassId, startDate: effectiveDate },
    });
    return tx.student.update({ where: { id: studentId }, data: { classId: toClassId } });
  });
}

/** Full class history for one student (admin or the class's teacher). */
export async function enrollmentHistory(user: CurrentUser, studentId: string) {
  const student = await db.student.findFirst({ where: { id: studentId, academyId: user.academyId } });
  if (!student) throw new AccessError();
  await assertClassAccess(user, student.classId);
  return db.enrollment.findMany({
    where: { studentId, academyId: user.academyId },
    orderBy: { startDate: "asc" },
  });
}

export async function deactivateStudent(user: CurrentUser, studentId: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can remove students");
  const student = await db.student.findFirst({
    where: { id: studentId, academyId: user.academyId },
  });
  if (!student) throw new AccessError();
  return db.student.update({ where: { id: studentId }, data: { active: false } });
}

/* ---------- Attendance ---------- */

/** Roster + today's saved statuses for one class on one date. */
export async function getAttendanceSheet(user: CurrentUser, classId: string, date: string, subjectId = "") {
  await assertClassAccess(user, classId);
  if (subjectId) await assertSubjectInClass(user, classId, subjectId);

  const students = await db.student.findMany({
    where: { classId, academyId: user.academyId, active: true },
    orderBy: { rollNumber: "asc" },
    select: { id: true, fullName: true, rollNumber: true },
  });

  const session = await db.attendanceSession.findFirst({
    where: { classId, academyId: user.academyId, date, subjectId },
    include: { records: { select: { studentId: true, status: true } } },
  });

  const statusByStudent = new Map(
    (session?.records ?? []).map((r) => [r.studentId, r.status as AttendanceStatus]),
  );

  return {
    students: students.map((s) => ({ ...s, status: statusByStudent.get(s.id) ?? null })),
    savedAt: session?.updatedAt ?? null,
  };
}

/** Teachers may change a submitted sheet for this long after the first submission. */
export const TEACHER_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export class EditWindowError extends Error {
  constructor(public needsReason: boolean) {
    super(needsReason ? "NEEDS_REASON" : "EDIT_WINDOW_CLOSED");
    this.name = "EditWindowError";
  }
}

/**
 * Saves a whole sheet in one transaction (all-or-nothing).
 * - Only student IDs in THIS class and academy are accepted.
 * - Every changed status is written to the audit log.
 * - Teachers can change a submitted sheet only within 48h of first submission.
 * - After that, only an admin can change it, and must give a reason.
 */
export async function saveAttendance(
  user: CurrentUser,
  classId: string,
  date: string,
  entries: { studentId: string; status: AttendanceStatus }[],
  options: { reason?: string; now?: Date; subjectId?: string } = {},
) {
  await assertClassAccess(user, classId);
  const now = options.now ?? new Date();

  const cancelled = await db.cancelledDay.findFirst({ where: { classId, academyId: user.academyId, date } });
  if (cancelled) throw new AccessError("This class day is cancelled. Attendance cannot be marked.");

  const validStudents = await db.student.findMany({
    where: { classId, academyId: user.academyId, active: true },
    select: { id: true },
  });
  const validIds = new Set(validStudents.map((s) => s.id));
  const safeEntries = entries.filter((e) => validIds.has(e.studentId));

  const subjectId = options.subjectId ?? "";
  if (subjectId) await assertSubjectInClass(user, classId, subjectId);

  const existing = await db.attendanceSession.findFirst({
    where: { classId, academyId: user.academyId, date, subjectId },
    include: { records: { select: { studentId: true, status: true } } },
  });

  if (existing?.submittedAt) {
    const closed = now.getTime() - existing.submittedAt.getTime() > TEACHER_EDIT_WINDOW_MS;
    if (closed && user.role !== "ADMIN") throw new EditWindowError(false);
    if (closed && user.role === "ADMIN" && !options.reason?.trim()) throw new EditWindowError(true);
  }

  const previous = new Map((existing?.records ?? []).map((r) => [r.studentId, r.status]));
  const changes = safeEntries.filter((e) => previous.get(e.studentId) !== e.status);
  const reason = options.reason?.trim() || null;

  return db.$transaction(async (tx) => {
    const session = existing
      ? await tx.attendanceSession.update({
          where: { id: existing.id },
          data: { markedById: user.id, status: "SUBMITTED", submittedAt: existing.submittedAt ?? now },
        })
      : await tx.attendanceSession.create({
          data: { academyId: user.academyId, classId, date, subjectId, markedById: user.id, status: "SUBMITTED", submittedAt: now },
        });

    for (const e of changes) {
      await tx.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: e.studentId } },
        create: { academyId: user.academyId, sessionId: session.id, studentId: e.studentId, status: e.status },
        update: { status: e.status },
      });
      await tx.auditLog.create({
        data: {
          academyId: user.academyId,
          actorId: user.id,
          action: "ATTENDANCE_CHANGED",
          entityType: "AttendanceRecord",
          entityId: "" + session.id + ":" + e.studentId,
          previousValue: previous.get(e.studentId) ?? null,
          newValue: e.status,
          reason,
        },
      });
    }
    return { saved: changes.length, unchanged: safeEntries.length - changes.length, sessionId: session.id };
  });
}

/** Per-student attendance summary for a date range (inclusive, YYYY-MM-DD). Uses the shared rules in lib/attendance-stats.ts. */
export async function attendanceReport(
  user: CurrentUser,
  classId: string,
  from: string,
  to: string,
  subjectId?: string, // undefined = all sessions for the class; "" = whole-class sessions only; id = that subject
) {
  await assertClassAccess(user, classId);
  if (subjectId) await assertSubjectInClass(user, classId, subjectId);

  const students = await db.student.findMany({
    where: { classId, academyId: user.academyId, active: true },
    orderBy: { rollNumber: "asc" },
    select: { id: true, fullName: true, rollNumber: true },
  });
  const sessions = await db.attendanceSession.findMany({
    where: {
      classId,
      academyId: user.academyId,
      date: { gte: from, lte: to },
      ...(subjectId === undefined ? {} : { subjectId }),
    },
    include: { records: { select: { studentId: true, status: true } } },
  });
  const cancelled = new Set(
    (await db.cancelledDay.findMany({ where: { classId, academyId: user.academyId, date: { gte: from, lte: to } }, select: { date: true } })).map((c) => c.date),
  );
  const enrollments = await db.enrollment.findMany({
    where: { academyId: user.academyId, classId },
    select: { studentId: true, startDate: true, endDate: true },
  });

  const statSessions: StatSession[] = sessions.map((s) => ({
    date: s.date,
    submitted: s.status === "SUBMITTED",
    cancelled: cancelled.has(s.date),
    statusByStudent: new Map(s.records.map((r) => [r.studentId, r.status])),
  }));

  return students.map((st) => {
    const stats = studentStats(st.id, statSessions, enrollments);
    return { ...st, ...stats, sessionCount: stats.eligible };
  });
}

/* ---------- CSV import (validate first, then write all-or-nothing) ---------- */

import { validateStudentCsv, type ImportResult } from "@/lib/csv-import";

/** Preview only: nothing is written. */
export async function previewStudentImport(user: CurrentUser, classId: string, csvText: string): Promise<ImportResult> {
  await assertClassAccess(user, classId);
  const existing = await db.student.findMany({
    where: { classId, academyId: user.academyId, active: true },
    select: { rollNumber: true },
  });
  return validateStudentCsv(csvText, existing.map((s) => s.rollNumber));
}

/** Re-validates on the server, then imports only if there are zero issues. */
export async function importStudents(user: CurrentUser, classId: string, csvText: string) {
  const preview = await previewStudentImport(user, classId, csvText);
  if (preview.issues.length > 0) {
    return { imported: 0, issues: preview.issues };
  }
  await assertWithinPlan(user.academyId, "student", preview.rows.length);
  const today = todayISO();
  await db.$transaction(async (tx) => {
    for (const row of preview.rows) {
      const student = await tx.student.create({
        data: {
          academyId: user.academyId,
          classId,
          fullName: row.fullName,
          rollNumber: row.rollNumber,
          guardianPhone: row.guardianPhone,
        },
      });
      await tx.enrollment.create({
        data: { academyId: user.academyId, studentId: student.id, classId, startDate: today },
      });
    }
  });
  return { imported: preview.rows.length, issues: [] as ImportResult["issues"] };
}

/* ---------- Timetable and cancelled days ---------- */

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Weekday (0 = Sunday) of a YYYY-MM-DD date, independent of the server's timezone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export async function listTimetable(user: CurrentUser, classId: string) {
  await assertClassAccess(user, classId);
  return db.timetableEntry.findMany({
    where: { classId, academyId: user.academyId },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  });
}

export async function addTimetableEntry(
  user: CurrentUser,
  classId: string,
  input: { weekday: number; startTime: string; endTime: string },
) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can edit the timetable");
  await assertClassAccess(user, classId);
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) throw new AccessError("Invalid weekday");
  if (!TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime)) throw new AccessError("Times must be HH:MM");
  if (input.startTime >= input.endTime) throw new AccessError("End time must be after start time");
  return db.timetableEntry.create({
    data: { academyId: user.academyId, classId, ...input },
  });
}

export async function deleteTimetableEntry(user: CurrentUser, entryId: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can edit the timetable");
  const entry = await db.timetableEntry.findFirst({ where: { id: entryId, academyId: user.academyId } });
  if (!entry) throw new AccessError();
  return db.timetableEntry.delete({ where: { id: entryId } });
}

/** Marks a class day as not happening. It is never counted as an absence. Admin only. */
export async function cancelDay(user: CurrentUser, classId: string, date: string, reason?: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can cancel class days");
  await assertClassAccess(user, classId);
  if (!isValidISODate(date)) throw new AccessError("Invalid date");
  return db.cancelledDay.upsert({
    where: { classId_date: { classId, date } },
    create: { academyId: user.academyId, classId, date, reason: reason || null },
    update: { reason: reason || null },
  });
}

export async function restoreDay(user: CurrentUser, classId: string, date: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can restore class days");
  await assertClassAccess(user, classId);
  await db.cancelledDay.deleteMany({ where: { classId, academyId: user.academyId, date } });
}

/** Classes the user teaches (or all, for admins) that meet on the given date and are not cancelled. */
export async function todaysSchedule(user: CurrentUser, date: string) {
  const weekday = weekdayOf(date);
  const entries = await db.timetableEntry.findMany({
    where: {
      academyId: user.academyId,
      weekday,
      class: user.role === "TEACHER" ? { teacherId: user.id } : undefined,
    },
    include: { class: { select: { id: true, name: true } } },
    orderBy: { startTime: "asc" },
  });
  const cancelled = await db.cancelledDay.findMany({
    where: { academyId: user.academyId, date, classId: { in: entries.map((e) => e.classId) } },
    select: { classId: true },
  });
  const cancelledIds = new Set(cancelled.map((c) => c.classId));
  return entries.map((e) => ({ ...e, cancelled: cancelledIds.has(e.classId) }));
}

/**
 * Creates OPEN attendance sessions (nothing marked yet) for every timetable day
 * between from and to (inclusive). Skips cancelled days and days that already
 * have a session. Admin only. Max 62 days per call to keep it bounded.
 */
export async function generateSessionsFromTimetable(user: CurrentUser, classId: string, from: string, to: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can generate sessions");
  await assertClassAccess(user, classId);
  if (!isValidISODate(from) || !isValidISODate(to) || from > to) throw new AccessError("Invalid date range");

  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days > 62) throw new AccessError("Generate at most 62 days at a time");

  const weekdays = new Set(
    (await db.timetableEntry.findMany({ where: { classId, academyId: user.academyId }, select: { weekday: true } })).map((e) => e.weekday),
  );
  const cancelled = new Set(
    (await db.cancelledDay.findMany({ where: { classId, academyId: user.academyId, date: { gte: from, lte: to } }, select: { date: true } })).map((c) => c.date),
  );
  const existing = new Set(
    (await db.attendanceSession.findMany({ where: { classId, academyId: user.academyId, date: { gte: from, lte: to } }, select: { date: true } })).map((s) => s.date),
  );

  const toCreate: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (!weekdays.has(weekdayOf(d)) || cancelled.has(d) || existing.has(d)) continue;
    toCreate.push(d);
  }
  if (toCreate.length) {
    await db.attendanceSession.createMany({
      data: toCreate.map((date) => ({ academyId: user.academyId, classId, date, markedById: user.id, status: "OPEN" })),
    });
  }
  return { created: toCreate.length };
}

/* ---------- Subjects ---------- */

export async function listSubjects(user: CurrentUser, classId: string) {
  await assertClassAccess(user, classId);
  return db.subject.findMany({ where: { classId, academyId: user.academyId }, orderBy: { name: "asc" } });
}

export async function addSubject(user: CurrentUser, classId: string, name: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can manage subjects");
  await assertClassAccess(user, classId);
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 60) throw new AccessError("Subject name must be 2-60 characters");
  return db.subject.create({ data: { academyId: user.academyId, classId, name: clean } });
}

export async function deleteSubject(user: CurrentUser, subjectId: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can manage subjects");
  const subject = await db.subject.findFirst({ where: { id: subjectId, academyId: user.academyId } });
  if (!subject) throw new AccessError();
  return db.subject.delete({ where: { id: subjectId } });
}

/* ---------- Dashboard: sessions that still need attendance ---------- */

/** Past sessions that were generated but never marked (status OPEN), for classes the user can see. */
export async function listNeedsAttention(user: CurrentUser, today: string) {
  return db.attendanceSession.findMany({
    where: {
      academyId: user.academyId,
      status: "OPEN",
      date: { lt: today },
      class: user.role === "TEACHER" ? { teacherId: user.id } : undefined,
    },
    include: { class: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: 30,
  });
}

/* ---------- Audit history (admin) ---------- */

export async function listAuditLog(user: CurrentUser, limit = 100) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can view the audit log");
  const logs = await db.auditLog.findMany({
    where: { academyId: user.academyId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
  const actorIds = [...new Set(logs.map((l) => l.actorId))];
  const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return logs.map((l) => ({ ...l, actorName: names.get(l.actorId) ?? "Unknown user" }));
}

/* ---------- Absence alerts and follow-up (Phase 4) ---------- */

import { evaluateRules, type RuleSession } from "@/lib/alert-rules";
import { inEnrollment } from "@/lib/attendance-stats";

/**
 * Evaluates the alert rules for every active student in a class and raises NEW alerts.
 * Dedup: at most one ACTIVE alert per student and rule. Existing active alerts are left alone;
 * alerts are resolved by a person (no automatic resolution in this version).
 */
export async function evaluateClassAlerts(user: CurrentUser, classId: string, today: string) {
  await assertClassAccess(user, classId);

  const students = await db.student.findMany({
    where: { classId, academyId: user.academyId, active: true },
    select: { id: true },
  });
  const sessions = await db.attendanceSession.findMany({
    where: { classId, academyId: user.academyId, status: "SUBMITTED" },
    include: { records: { select: { studentId: true, status: true } } },
  });
  const cancelled = new Set(
    (await db.cancelledDay.findMany({ where: { classId, academyId: user.academyId }, select: { date: true } })).map((c) => c.date),
  );
  const enrollments = await db.enrollment.findMany({
    where: { academyId: user.academyId, classId },
    select: { studentId: true, startDate: true, endDate: true },
  });
  const active = await db.absenceAlert.findMany({
    where: { classId, academyId: user.academyId, status: "ACTIVE" },
    select: { studentId: true, rule: true },
  });
  const activeKeys = new Set(active.map((a) => `${a.studentId}|${a.rule}`));

  let created = 0;
  const raised: string[] = [];
  for (const st of students) {
    const counted: RuleSession[] = [];
    let eligible = 0;
    let attended = 0;
    for (const s of sessions) {
      if (cancelled.has(s.date) || !inEnrollment(s.date, enrollments, st.id)) continue;
      const rec = s.records.find((r) => r.studentId === st.id);
      if (!rec) continue;
      counted.push({ date: s.date, status: rec.status });
      if (rec.status === "LEAVE") continue;
      eligible++;
      if (rec.status === "PRESENT" || rec.status === "LATE") attended++;
    }
    const percent = eligible === 0 ? null : Math.round((attended / eligible) * 100);

    for (const alert of evaluateRules(counted, percent, eligible, today)) {
      if (activeKeys.has(`${st.id}|${alert.rule}`)) continue;
      await db.absenceAlert.create({
        data: { academyId: user.academyId, studentId: st.id, classId, rule: alert.rule, detail: alert.detail },
      });
      activeKeys.add(`${st.id}|${alert.rule}`);
      created++;
      raised.push(st.id);
    }
  }
  if (created > 0) {
    const ids = await adminIds(user.academyId);
    const n = created === 1 ? "1 student needs" : `${created} students need`;
    await notifyUsers(user.academyId, ids, "New absence alert", `${n} follow-up.`, "/alerts").catch(() => undefined);
  }
  return { created };
}

/** Alerts for classes the user can see. Teachers only see their own classes. */
export async function listAlerts(user: CurrentUser, status: "ACTIVE" | "RESOLVED" = "ACTIVE") {
  const visible = await listClasses(user);
  const classIds = visible.map((c) => c.id);
  const alerts = await db.absenceAlert.findMany({
    where: { academyId: user.academyId, status, classId: { in: classIds } },
    include: {
      student: { select: { fullName: true, rollNumber: true } },
      tasks: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { raisedAt: "desc" },
    take: 200,
  });
  const names = new Map(visible.map((c) => [c.id, c.name]));
  return alerts.map((a) => ({ ...a, className: names.get(a.classId) ?? "" }));
}

export async function resolveAlert(user: CurrentUser, alertId: string) {
  const alert = await db.absenceAlert.findFirst({ where: { id: alertId, academyId: user.academyId } });
  if (!alert) throw new AccessError();
  await assertClassAccess(user, alert.classId);
  return db.absenceAlert.update({
    where: { id: alertId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: user.id },
  });
}

export async function addFollowUp(
  user: CurrentUser,
  alertId: string,
  input: { assignedToId: string; dueDate: string; notes?: string },
) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can assign follow-up");
  const alert = await db.absenceAlert.findFirst({ where: { id: alertId, academyId: user.academyId } });
  if (!alert) throw new AccessError();
  const assignee = await db.user.findFirst({ where: { id: input.assignedToId, academyId: user.academyId, active: true } });
  if (!assignee) throw new AccessError("Assignee not found in your academy");
  if (!isValidISODate(input.dueDate)) throw new AccessError("Invalid due date");
  const task = await db.followUpTask.create({
    data: {
      academyId: user.academyId,
      alertId,
      assignedToId: assignee.id,
      dueDate: input.dueDate,
      notes: input.notes?.slice(0, 500) || null,
    },
  });
  await notifyUsers(user.academyId, [assignee.id], "Follow-up assigned", `Due ${input.dueDate}${input.notes ? `: ${input.notes}` : ""}`, "/alerts").catch(() => undefined);
  return task;
}

/** Completes a follow-up. The assignee or any admin can complete it and record the reason given. */
export async function completeFollowUp(user: CurrentUser, taskId: string, reason?: string, notes?: string) {
  const task = await db.followUpTask.findFirst({ where: { id: taskId, academyId: user.academyId } });
  if (!task) throw new AccessError();
  if (user.role !== "ADMIN" && task.assignedToId !== user.id) throw new AccessError();
  return db.followUpTask.update({
    where: { id: taskId },
    data: { status: "DONE", reason: reason?.slice(0, 40) || task.reason, notes: notes?.slice(0, 500) || task.notes },
  });
}

/** A subject must belong to this class and academy. */
export async function assertSubjectInClass(user: CurrentUser, classId: string, subjectId: string) {
  const subject = await db.subject.findFirst({ where: { id: subjectId, classId, academyId: user.academyId } });
  if (!subject) throw new AccessError("Subject not found in this class");
  return subject;
}

/* ---------- Dashboard: trend, setup checklist, student profile ---------- */

/** Daily attendance % across the classes the user can see, for the last `days` days (oldest first). */
export async function dailyAttendanceTrend(user: CurrentUser, today: string, days = 14) {
  const visible = (await listClasses(user)).map((c) => c.id);
  const from = shiftISO(today, -(days - 1));
  const sessions = await db.attendanceSession.findMany({
    where: { academyId: user.academyId, status: "SUBMITTED", classId: { in: visible }, date: { gte: from, lte: today } },
    include: { records: { select: { status: true } } },
  });
  const byDay = new Map<string, { attended: number; eligible: number }>();
  for (const s of sessions) {
    const bucket = byDay.get(s.date) ?? { attended: 0, eligible: 0 };
    for (const r of s.records) {
      if (r.status === "LEAVE") continue;
      bucket.eligible++;
      if (r.status === "PRESENT" || r.status === "LATE") bucket.attended++;
    }
    byDay.set(s.date, bucket);
  }
  return Array.from({ length: days }, (_, i) => {
    const date = shiftISO(from, i);
    const b = byDay.get(date);
    return { date, percent: b && b.eligible > 0 ? Math.round((b.attended / b.eligible) * 100) : null };
  });
}

function shiftISO(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
}

/** Setup progress for a new academy (admins only). */
export async function setupProgress(user: CurrentUser) {
  const [teachers, classes, students, slots] = await Promise.all([
    db.user.count({ where: { academyId: user.academyId, role: "TEACHER" } }),
    db.class.count({ where: { academyId: user.academyId } }),
    db.student.count({ where: { academyId: user.academyId, active: true } }),
    db.timetableEntry.count({ where: { academyId: user.academyId } }),
  ]);
  return [
    { label: "Add a teacher", done: teachers > 0, href: "/teachers" },
    { label: "Create a class", done: classes > 0, href: "/classes/new" },
    { label: "Add students (or import a CSV)", done: students > 0, href: "/dashboard" },
    { label: "Add a weekly timetable slot", done: slots > 0, href: "/dashboard" },
    { label: "Mark the first attendance", done: (await db.attendanceSession.count({ where: { academyId: user.academyId, status: "SUBMITTED" } })) > 0, href: "/dashboard" },
  ];
}

/** Student profile for admins and the student's class teacher. */
export async function studentProfile(user: CurrentUser, studentId: string) {
  const student = await db.student.findFirst({ where: { id: studentId, academyId: user.academyId } });
  if (!student) throw new AccessError();
  await assertClassAccess(user, student.classId);

  const enrollments = await db.enrollment.findMany({ where: { studentId, academyId: user.academyId }, orderBy: { startDate: "asc" } });
  const records = await db.attendanceRecord.findMany({
    where: { studentId, academyId: user.academyId, session: { status: "SUBMITTED" } },
    include: { session: { select: { date: true, classId: true, subjectId: true } } },
    orderBy: { session: { date: "desc" } },
    take: 60,
  });
  const cancelled = new Set(
    (await db.cancelledDay.findMany({ where: { academyId: user.academyId, classId: student.classId }, select: { date: true } })).map((c) => c.date),
  );
  const allSessions = await db.attendanceSession.findMany({
    where: { academyId: user.academyId, classId: student.classId, status: "SUBMITTED" },
    include: { records: { where: { studentId }, select: { status: true } } },
  });
  const statSessions = allSessions.map((s) => ({
    date: s.date,
    submitted: true,
    cancelled: cancelled.has(s.date),
    statusByStudent: new Map(s.records.map((r) => [studentId, r.status])),
  }));
  const stats = studentStats(studentId, statSessions, enrollments.map((e) => ({ studentId, startDate: e.startDate, endDate: e.endDate })));
  const alerts = await db.absenceAlert.findMany({
    where: { studentId, academyId: user.academyId },
    include: { tasks: { orderBy: { createdAt: "desc" } } },
    orderBy: { raisedAt: "desc" },
  });
  return { student, enrollments, records, stats, alerts };
}

/* ---------- Notifications ---------- */

/** Creates an in-app notification for each recipient. Runs inside the caller's flow; never throws for the caller's core action. */
export async function notifyUsers(academyId: string, userIds: string[], title: string, body: string, link?: string) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  await db.notification.createMany({
    data: unique.map((userId) => ({ academyId, userId, title: title.slice(0, 120), body: body.slice(0, 400), link: link ?? null })),
  });
  return unique.length;
}

/** All admins of an academy (active only). */
export async function adminIds(academyId: string): Promise<string[]> {
  return (await db.user.findMany({ where: { academyId, role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);
}

export async function listNotifications(user: CurrentUser, limit = 50) {
  return db.notification.findMany({
    where: { userId: user.id, academyId: user.academyId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

export async function unreadCount(user: CurrentUser) {
  return db.notification.count({ where: { userId: user.id, academyId: user.academyId, readAt: null } });
}

export async function markAllRead(user: CurrentUser) {
  await db.notification.updateMany({
    where: { userId: user.id, academyId: user.academyId, readAt: null },
    data: { readAt: new Date() },
  });
}

/* ---------- Student and guardian portal (read-only, plus correction requests) ---------- */

/** Students a portal user may view: a STUDENT sees their own record; a GUARDIAN sees linked students only. */
export async function portalStudents(user: CurrentUser) {
  let studentIds: string[] = [];
  if (user.role === "STUDENT" && user.studentId) studentIds = [user.studentId];
  if (user.role === "GUARDIAN") {
    studentIds = (await db.guardianLink.findMany({ where: { userId: user.id, academyId: user.academyId }, select: { studentId: true } })).map((g) => g.studentId);
  }
  if (studentIds.length === 0) return [];

  const students = await db.student.findMany({ where: { id: { in: studentIds }, academyId: user.academyId } });
  const out = [];
  for (const st of students) {
    const enrollments = await db.enrollment.findMany({ where: { studentId: st.id, academyId: user.academyId } });
    const cancelled = new Set(
      (await db.cancelledDay.findMany({ where: { academyId: user.academyId, classId: st.classId }, select: { date: true } })).map((c) => c.date),
    );
    const sessions = await db.attendanceSession.findMany({
      where: { academyId: user.academyId, classId: st.classId, status: "SUBMITTED" },
      include: { records: { where: { studentId: st.id }, select: { status: true } } },
      orderBy: { date: "desc" },
    });
    const statSessions = sessions.map((s) => ({
      date: s.date,
      submitted: true,
      cancelled: cancelled.has(s.date),
      statusByStudent: new Map(s.records.map((r) => [st.id, r.status])),
    }));
    const stats = studentStats(st.id, statSessions, enrollments.map((e) => ({ studentId: st.id, startDate: e.startDate, endDate: e.endDate })));
    const recent = sessions
      .filter((s) => s.records.length > 0)
      .slice(0, 20)
      .map((s) => ({ date: s.date, status: s.records[0].status }));
    out.push({ student: st, stats, recent });
  }
  return out;
}

async function assertCanActFor(user: CurrentUser, studentId: string) {
  if (user.role === "STUDENT" && user.studentId === studentId) return;
  if (user.role === "GUARDIAN") {
    const link = await db.guardianLink.findFirst({ where: { userId: user.id, studentId, academyId: user.academyId } });
    if (link) return;
  }
  throw new AccessError();
}

/** A student or linked guardian asks for one past mark to be corrected. An admin decides. */
export async function requestCorrection(user: CurrentUser, studentId: string, date: string, requestedStatus: AttendanceStatus, reason: string) {
  await assertCanActFor(user, studentId);
  if (!isValidISODate(date)) throw new AccessError("Invalid date");
  const student = await db.student.findFirst({ where: { id: studentId, academyId: user.academyId } });
  if (!student) throw new AccessError();
  const hasRecord = await db.attendanceRecord.findFirst({
    where: { studentId, academyId: user.academyId, session: { date, classId: student.classId, status: "SUBMITTED", subjectId: "" } },
  });
  if (!hasRecord) throw new AccessError("There is no submitted attendance for that day");
  const reasonClean = reason.trim().slice(0, 300);
  if (reasonClean.length < 5) throw new AccessError("Please explain the correction (at least 5 characters)");

  const req = await db.correctionRequest.create({
    data: { academyId: user.academyId, studentId, classId: student.classId, date, requestedStatus, reason: reasonClean, requestedById: user.id },
  });
  await notifyUsers(user.academyId, await adminIds(user.academyId), "Correction requested", `${student.fullName}: ${date} to ${requestedStatus}`, "/corrections").catch(() => undefined);
  return req;
}

export async function listCorrections(user: CurrentUser, status = "PENDING") {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can review corrections");
  const reqs = await db.correctionRequest.findMany({ where: { academyId: user.academyId, status }, orderBy: { createdAt: "desc" }, take: 100 });
  const students = await db.student.findMany({ where: { id: { in: reqs.map((r) => r.studentId) } }, select: { id: true, fullName: true } });
  const names = new Map(students.map((s) => [s.id, s.fullName]));
  return reqs.map((r) => ({ ...r, studentName: names.get(r.studentId) ?? "Unknown" }));
}

/** Admin decision. Approving writes the corrected mark through the normal save path (audited, with the reason). */
export async function decideCorrection(user: CurrentUser, requestId: string, approve: boolean, note: string) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can decide corrections");
  const req = await db.correctionRequest.findFirst({ where: { id: requestId, academyId: user.academyId, status: "PENDING" } });
  if (!req) throw new AccessError();

  if (approve) {
    await saveAttendance(user, req.classId, req.date, [{ studentId: req.studentId, status: req.requestedStatus as AttendanceStatus }], {
      reason: `Correction approved: ${req.reason}${note ? ` (${note.slice(0, 200)})` : ""}`,
    });
  }
  await db.correctionRequest.update({
    where: { id: requestId },
    data: { status: approve ? "APPROVED" : "REJECTED", decidedById: user.id, decidedAt: new Date() },
  });
  await notifyUsers(
    user.academyId,
    [req.requestedById],
    approve ? "Correction approved" : "Correction declined",
    `${req.date}: ${approve ? "the mark was updated." : "no change was made."}`,
    "/me",
  ).catch(() => undefined);
  return { ok: true };
}

/** Admin creates a student login (linked to that student) or a guardian login (linked to that student, with consent recorded). */
export async function createPortalAccount(
  user: CurrentUser,
  input: { role: "STUDENT" | "GUARDIAN"; name: string; email: string; passwordHash: string; studentId: string; consent: boolean },
) {
  if (user.role !== "ADMIN") throw new AccessError("Only admins can create portal accounts");
  const student = await db.student.findFirst({ where: { id: input.studentId, academyId: user.academyId, active: true } });
  if (!student) throw new AccessError("Student not found");
  if (input.role === "GUARDIAN" && !input.consent) throw new AccessError("Record guardian consent before creating a guardian login");

  return db.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        academyId: user.academyId,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
        studentId: input.role === "STUDENT" ? student.id : null,
      },
    });
    if (input.role === "GUARDIAN") {
      await tx.guardianLink.create({
        data: { academyId: user.academyId, userId: account.id, studentId: student.id, consentAt: new Date() },
      });
    }
    return account;
  });
}

/* ---------- Plans, usage limits and the platform owner ---------- */

import { PLANS, type PlanCode } from "@/lib/plans";

export async function planUsage(academyId: string) {
  const academy = await db.academy.findUnique({ where: { id: academyId } });
  if (!academy) throw new AccessError();
  const plan = PLANS[academy.planCode as PlanCode] ?? PLANS.STARTER;
  const [students, teachers] = await Promise.all([
    db.student.count({ where: { academyId, active: true } }),
    db.user.count({ where: { academyId, role: "TEACHER", active: true } }),
  ]);
  return { plan, students, teachers, status: academy.subscriptionStatus, trialEndsAt: academy.trialEndsAt };
}

/** Throws when adding would exceed the academy's plan. Called before adding students or teachers. */
export async function assertWithinPlan(academyId: string, kind: "student" | "teacher", adding = 1) {
  const usage = await planUsage(academyId);
  if (usage.status === "SUSPENDED") throw new AccessError("This academy is suspended. Contact support.");
  if (kind === "student" && usage.students + adding > usage.plan.maxStudents) {
    throw new AccessError(`Your ${usage.plan.name} plan allows ${usage.plan.maxStudents} active students. Upgrade to add more.`);
  }
  if (kind === "teacher" && usage.teachers + adding > usage.plan.maxTeachers) {
    throw new AccessError(`Your ${usage.plan.name} plan allows ${usage.plan.maxTeachers} teachers. Upgrade to add more.`);
  }
}

/** Platform owner only. Lists academies with counts. Student names and records are NOT shown here. */
export async function listAcademiesForPlatform(user: CurrentUser) {
  if (user.role !== "SUPER_ADMIN") throw new AccessError();
  const academies = await db.academy.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const rows = [];
  for (const a of academies) {
    rows.push({
      id: a.id,
      name: a.name,
      active: a.active,
      planCode: a.planCode,
      subscriptionStatus: a.subscriptionStatus,
      trialEndsAt: a.trialEndsAt,
      students: await db.student.count({ where: { academyId: a.id, active: true } }),
      teachers: await db.user.count({ where: { academyId: a.id, role: "TEACHER", active: true } }),
      createdAt: a.createdAt,
    });
  }
  return rows;
}

/** Platform owner changes an academy's plan/status. Every change is audited with a reason. */
export async function updateAcademyBilling(
  user: CurrentUser,
  academyId: string,
  input: { planCode: string; subscriptionStatus: string; active: boolean; reason: string },
) {
  if (user.role !== "SUPER_ADMIN") throw new AccessError();
  if (!(input.planCode in PLANS)) throw new AccessError("Unknown plan");
  if (!["TRIAL", "ACTIVE", "SUSPENDED"].includes(input.subscriptionStatus)) throw new AccessError("Unknown status");
  if (input.reason.trim().length < 5) throw new AccessError("Give a reason (at least 5 characters)");
  const before = await db.academy.findUnique({ where: { id: academyId } });
  if (!before) throw new AccessError();
  await db.$transaction(async (tx) => {
    await tx.academy.update({
      where: { id: academyId },
      data: { planCode: input.planCode, subscriptionStatus: input.subscriptionStatus, active: input.active },
    });
    await tx.auditLog.create({
      data: {
        academyId,
        actorId: user.id,
        action: "PLATFORM_BILLING_CHANGED",
        entityType: "Academy",
        entityId: academyId,
        previousValue: `${before.planCode}/${before.subscriptionStatus}/${before.active ? "active" : "inactive"}`,
        newValue: `${input.planCode}/${input.subscriptionStatus}/${input.active ? "active" : "inactive"}`,
        reason: input.reason.trim().slice(0, 300),
      },
    });
  });
  return { ok: true };
}
