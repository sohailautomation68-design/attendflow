import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

// Use a SEPARATE test database so tests never touch dev data.
const testDbPath = path.resolve(__dirname, "..", "prisma", "test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-test-secret-test-secret-123456";

type Db = typeof import("@/lib/db").db;
type Data = typeof import("@/lib/data");

let db: Db;
let data: Data;
let AccessErrorClass: new (...args: never[]) => Error;

// Two separate academies, each with its own admin, teacher, class and students.
let A: { admin: CurrentUserLike; teacher: CurrentUserLike; classId: string; studentId: string };
let B: { admin: CurrentUserLike; teacher: CurrentUserLike; classId: string; studentId: string; teacherId: string };
let otherTeacherA: CurrentUserLike; // teacher in academy A who is NOT assigned to A's class

type CurrentUserLike = {
  id: string;
  academyId: string;
  academyName: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "GUARDIAN" | "SUPER_ADMIN";
  studentId: string | null;
};

beforeAll(async () => {
  // Build a fresh test database from the schema.
  if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "ignore",
  });

  db = (await import("@/lib/db")).db;
  data = await import("@/lib/data");
  AccessErrorClass = data.AccessError;

  const makeAcademy = async (name: string) => {
    const academy = await db.academy.create({ data: { name } });
    const admin = await db.user.create({
      data: { academyId: academy.id, email: `admin-${academy.id}@test.local`, name: `Admin ${name}`, passwordHash: "x", role: "ADMIN" },
    });
    const teacher = await db.user.create({
      data: { academyId: academy.id, email: `teacher-${academy.id}@test.local`, name: `Teacher ${name}`, passwordHash: "x", role: "TEACHER" },
    });
    const other = await db.user.create({
      data: { academyId: academy.id, email: `other-${academy.id}@test.local`, name: `Other ${name}`, passwordHash: "x", role: "TEACHER" },
    });
    const cls = await db.class.create({ data: { academyId: academy.id, name: `${name} Class`, teacherId: teacher.id } });
    const student = await db.student.create({
      data: { academyId: academy.id, classId: cls.id, fullName: `Student ${name}`, rollNumber: "1" },
    });
    const toUser = (u: typeof admin, aName: string): CurrentUserLike => ({
      id: u.id,
      academyId: u.academyId,
      academyName: aName,
      name: u.name,
      email: u.email,
      role: u.role as "ADMIN" | "TEACHER",
      studentId: null,
    });
    return {
      admin: toUser(admin, name),
      teacher: toUser(teacher, name),
      other: toUser(other, name),
      classId: cls.id,
      studentId: student.id,
    };
  };

  const a = await makeAcademy("Alpha");
  const b = await makeAcademy("Beta");
  A = { admin: a.admin, teacher: a.teacher, classId: a.classId, studentId: a.studentId };
  B = { admin: b.admin, teacher: b.teacher, classId: b.classId, studentId: b.studentId, teacherId: b.teacher.id };
  otherTeacherA = a.other;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("tenant isolation", () => {
  it("an admin cannot read a class in another academy", async () => {
    await expect(data.getClass(A.admin, B.classId)).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("a teacher cannot read a class in another academy", async () => {
    await expect(data.getClass(A.teacher, B.classId)).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("a teacher cannot read the attendance sheet of another academy", async () => {
    await expect(data.getAttendanceSheet(A.teacher, B.classId, "2026-01-05")).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("a teacher cannot save attendance into another academy's class", async () => {
    await expect(
      data.saveAttendance(A.teacher, B.classId, "2026-01-05", [{ studentId: B.studentId, status: "PRESENT" }]),
    ).rejects.toBeInstanceOf(AccessErrorClass);
    const leaked = await db.attendanceRecord.count({ where: { studentId: B.studentId } });
    expect(leaked).toBe(0);
  });

  it("a teacher NOT assigned to a class cannot access it (same academy)", async () => {
    await expect(data.getClass(otherTeacherA, A.classId)).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("the assigned teacher CAN access their own class", async () => {
    const cls = await data.getClass(A.teacher, A.classId);
    expect(cls.id).toBe(A.classId);
  });

  it("an admin cannot assign a teacher from another academy to their class", async () => {
    await expect(data.assignTeacher(A.admin, A.classId, B.teacherId)).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("an admin cannot create a class assigned to another academy's teacher", async () => {
    await expect(
      data.createClass(A.admin, { name: "Sneaky", teacherId: B.teacherId }),
    ).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("a teacher cannot create classes (admin only)", async () => {
    await expect(data.createClass(A.teacher, { name: "Nope" })).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("class lists never include another academy's classes", async () => {
    const aList = await data.listClasses(A.admin);
    expect(aList.every((c) => c.id !== B.classId)).toBe(true);
    const bList = await data.listClasses(B.admin);
    expect(bList.every((c) => c.id !== A.classId)).toBe(true);
  });

  it("injected student IDs from another class are silently ignored when saving", async () => {
    // A's teacher saves a valid A student plus B's student ID. Only A's student is written.
    const result = await data.saveAttendance(A.teacher, A.classId, "2026-02-02", [
      { studentId: A.studentId, status: "PRESENT" },
      { studentId: B.studentId, status: "ABSENT" },
    ]);
    expect(result.saved).toBe(1);
    const bRecords = await db.attendanceRecord.count({ where: { studentId: B.studentId } });
    expect(bRecords).toBe(0);
  });

  it("a teacher can save and re-read their class attendance", async () => {
    await data.saveAttendance(A.teacher, A.classId, "2026-03-03", [{ studentId: A.studentId, status: "LATE" }]);
    const sheet = await data.getAttendanceSheet(A.teacher, A.classId, "2026-03-03");
    expect(sheet.students[0].status).toBe("LATE");
  });
});

describe("student transfer and enrollment history", () => {
  it("moves a student, closes the old enrollment and opens a new one", async () => {
    const newClass = await db.class.create({ data: { academyId: A.admin.academyId, name: "Grade 6" } });
    const student = await db.student.create({
      data: { academyId: A.admin.academyId, classId: A.classId, fullName: "Transfer Kid", rollNumber: "90" },
    });
    await db.enrollment.create({
      data: { academyId: A.admin.academyId, studentId: student.id, classId: A.classId, startDate: "2026-01-01" },
    });

    await data.transferStudent(A.admin, student.id, newClass.id, "2026-02-01");

    const history = await data.enrollmentHistory(A.admin, student.id);
    expect(history.map((h) => [h.classId, h.startDate, h.endDate])).toEqual([
      [A.classId, "2026-01-01", "2026-02-01"],
      [newClass.id, "2026-02-01", null],
    ]);
    const fresh = await db.student.findUnique({ where: { id: student.id } });
    expect(fresh?.classId).toBe(newClass.id);
  });

  it("an admin cannot move a student into another academy's class", async () => {
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    await expect(data.transferStudent(A.admin, student!.id, B.classId)).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("a teacher cannot transfer students", async () => {
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    await expect(data.transferStudent(A.teacher, student!.id, A.classId)).rejects.toBeInstanceOf(AccessErrorClass);
  });
});

describe("attendance submit, 48h edit window and audit log", () => {
  const H = 60 * 60 * 1000;
  const date = "2026-05-05";

  it("first save is SUBMITTED and writes audit entries for changes", async () => {
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    const r = await data.saveAttendance(A.teacher, A.classId, date, [{ studentId: student!.id, status: "PRESENT" }]);
    expect(r.saved).toBe(1);
    const session = await db.attendanceSession.findUnique({ where: { id: r.sessionId } });
    expect(session?.status).toBe("SUBMITTED");
    expect(session?.submittedAt).not.toBeNull();
    const logs = await db.auditLog.findMany({ where: { academyId: A.admin.academyId, entityId: { startsWith: r.sessionId } } });
    expect(logs[0].previousValue).toBeNull();
    expect(logs[0].newValue).toBe("PRESENT");
  });

  it("teacher can change the sheet within 48 hours, and the change is audited", async () => {
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    const soon = new Date(Date.now() + 2 * H);
    const r = await data.saveAttendance(A.teacher, A.classId, date, [{ studentId: student!.id, status: "ABSENT" }], { now: soon });
    expect(r.saved).toBe(1);
    const log = await db.auditLog.findFirst({
      where: { academyId: A.admin.academyId, newValue: "ABSENT", previousValue: "PRESENT" },
    });
    expect(log).not.toBeNull();
  });

  it("teacher is blocked after 48 hours", async () => {
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    const late = new Date(Date.now() + 49 * H);
    await expect(
      data.saveAttendance(A.teacher, A.classId, date, [{ studentId: student!.id, status: "PRESENT" }], { now: late }),
    ).rejects.toMatchObject({ needsReason: false });
  });

  it("admin must give a reason after 48 hours, and the reason is recorded", async () => {
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    const late = new Date(Date.now() + 49 * H);
    await expect(
      data.saveAttendance(A.admin, A.classId, date, [{ studentId: student!.id, status: "PRESENT" }], { now: late }),
    ).rejects.toMatchObject({ needsReason: true });

    await data.saveAttendance(A.admin, A.classId, date, [{ studentId: student!.id, status: "PRESENT" }], {
      now: late,
      reason: "Parent confirmed student attended",
    });
    const log = await db.auditLog.findFirst({
      where: { academyId: A.admin.academyId, reason: "Parent confirmed student attended" },
    });
    expect(log?.newValue).toBe("PRESENT");
  });
});

describe("timetable and cancelled days", () => {
  it("weekdayOf returns the correct weekday regardless of server timezone", () => {
    expect(data.weekdayOf("2026-11-25")).toBe(3); // Wednesday
    expect(data.weekdayOf("2026-11-29")).toBe(0); // Sunday
  });

  it("admin adds a valid slot; invalid times are rejected", async () => {
    const slot = await data.addTimetableEntry(A.admin, A.classId, { weekday: 1, startTime: "09:00", endTime: "10:30" });
    expect(slot.weekday).toBe(1);
    await expect(
      data.addTimetableEntry(A.admin, A.classId, { weekday: 1, startTime: "11:00", endTime: "10:00" }),
    ).rejects.toThrow(/after start/);
    await expect(
      data.addTimetableEntry(A.admin, A.classId, { weekday: 9, startTime: "09:00", endTime: "10:00" }),
    ).rejects.toThrow(/weekday/);
  });

  it("a teacher cannot edit the timetable", async () => {
    await expect(
      data.addTimetableEntry(A.teacher, A.classId, { weekday: 2, startTime: "09:00", endTime: "10:00" }),
    ).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("today's schedule shows the slot and marks it cancelled when the day is cancelled", async () => {
    // 2026-11-02 is a Monday (weekday 1)
    const before = await data.todaysSchedule(A.teacher, "2026-11-02");
    expect(before.some((s) => s.classId === A.classId && !s.cancelled)).toBe(true);

    await data.cancelDay(A.admin, A.classId, "2026-11-02", "Public holiday");
    const after = await data.todaysSchedule(A.teacher, "2026-11-02");
    expect(after.find((s) => s.classId === A.classId)?.cancelled).toBe(true);
  });

  it("attendance cannot be marked on a cancelled day", async () => {
    await expect(
      data.saveAttendance(A.teacher, A.classId, "2026-11-02", [{ studentId: A.studentId, status: "ABSENT" }]),
    ).rejects.toThrow(/cancelled/);
    const count = await db.attendanceRecord.count({ where: { studentId: A.studentId, session: { date: "2026-11-02" } } });
    expect(count).toBe(0);
  });

  it("restoring the day makes it markable again", async () => {
    await data.restoreDay(A.admin, A.classId, "2026-11-02");
    const r = await data.saveAttendance(A.teacher, A.classId, "2026-11-02", [{ studentId: A.studentId, status: "PRESENT" }]);
    expect(r.saved).toBe(1);
  });
});

describe("session generation from timetable", () => {
  it("creates OPEN sessions only on timetable weekdays, once", async () => {
    // Timetable has a Monday slot (weekday 1). Dec 1-13 2026 contains one Monday (Dec 7).
    const first = await data.generateSessionsFromTimetable(A.admin, A.classId, "2026-12-01", "2026-12-13");
    expect(first.created).toBe(1);
    const s = await db.attendanceSession.findFirst({ where: { classId: A.classId, date: "2026-12-07" } });
    expect(s?.status).toBe("OPEN");

    const second = await data.generateSessionsFromTimetable(A.admin, A.classId, "2026-12-01", "2026-12-13");
    expect(second.created).toBe(0);
  });

  it("teachers cannot generate sessions", async () => {
    await expect(
      data.generateSessionsFromTimetable(A.teacher, A.classId, "2026-12-01", "2026-12-13"),
    ).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("an OPEN session does not count in the report", async () => {
    const report = await data.attendanceReport(A.admin, A.classId, "2026-12-01", "2026-12-13");
    const row = report.find((r) => r.id === A.studentId);
    expect(row?.eligible).toBe(0);
    expect(row?.percent).toBeNull();
  });
});

describe("subjects, needs-attention list and audit history", () => {
  it("admin adds and removes subjects; duplicates are rejected", async () => {
    const s = await data.addSubject(A.admin, A.classId, "Mathematics");
    await expect(data.addSubject(A.admin, A.classId, "Mathematics")).rejects.toThrow();
    const list = await data.listSubjects(A.admin, A.classId);
    expect(list.map((x) => x.name)).toContain("Mathematics");
    await data.deleteSubject(A.admin, s.id);
    expect((await data.listSubjects(A.admin, A.classId)).length).toBe(0);
  });

  it("teachers cannot add subjects", async () => {
    await expect(data.addSubject(A.teacher, A.classId, "Physics")).rejects.toBeInstanceOf(AccessErrorClass);
  });

  it("needs-attention lists past OPEN days, and only for visible classes", async () => {
    // Dec 7 2026 was generated as OPEN earlier; today is treated as 2027-01-01.
    const mine = await data.listNeedsAttention(A.teacher, "2027-01-01");
    expect(mine.some((n) => n.date === "2026-12-07" && n.status === "OPEN")).toBe(true);
    const other = await data.listNeedsAttention(B.teacher, "2027-01-01");
    expect(other.every((n) => n.classId !== A.classId)).toBe(true);
  });

  it("audit history is admin-only and returns actor names", async () => {
    await expect(data.listAuditLog(A.teacher)).rejects.toBeInstanceOf(AccessErrorClass);
    const logs = await data.listAuditLog(A.admin, 50);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorName).toBeTruthy();
    expect(logs.every((l) => l.academyId === A.admin.academyId)).toBe(true);
  });
});

describe("absence alerts (end to end on the database)", () => {
  let s2: { id: string };
  const dates = ["2027-01-04", "2027-01-05", "2027-01-06"];

  it("raises one alert after 3 absences in a row, without duplicates", async () => {
    s2 = await db.student.create({
      data: { academyId: A.admin.academyId, classId: A.classId, fullName: "Alert Kid", rollNumber: "77" },
    });
    await db.enrollment.create({
      data: { academyId: A.admin.academyId, studentId: s2.id, classId: A.classId, startDate: "2027-01-01" },
    });
    for (const d of dates) {
      await data.saveAttendance(A.teacher, A.classId, d, [{ studentId: s2.id, status: "ABSENT" }]);
    }

    const first = await data.evaluateClassAlerts(A.teacher, A.classId, "2027-01-07");
    expect(first.created).toBeGreaterThanOrEqual(1);
    const second = await data.evaluateClassAlerts(A.teacher, A.classId, "2027-01-07");
    expect(second.created).toBe(0);

    const mine = await db.absenceAlert.findMany({ where: { studentId: s2.id, rule: "CONSECUTIVE_ABSENCES", status: "ACTIVE" } });
    expect(mine.length).toBe(1);
    expect(mine[0].detail).toMatch(/3 consecutive/);
  });

  it("an admin can assign a follow-up and the assignee can complete it", async () => {
    const alert = await db.absenceAlert.findFirst({ where: { studentId: s2.id, status: "ACTIVE" } });
    const task = await data.addFollowUp(A.admin, alert!.id, { assignedToId: A.teacher.id, dueDate: "2027-01-10", notes: "Call father" });
    expect(task.status).toBe("OPEN");

    const done = await data.completeFollowUp(A.teacher, task.id, "Sickness", "Family said flu");
    expect(done.status).toBe("DONE");
    expect(done.reason).toBe("Sickness");
  });

  it("teachers cannot assign follow-up, and resolving removes the alert from the active list", async () => {
    const alert = await db.absenceAlert.findFirst({ where: { studentId: s2.id, status: "ACTIVE" } });
    await expect(data.addFollowUp(A.teacher, alert!.id, { assignedToId: A.teacher.id, dueDate: "2027-01-10" })).rejects.toBeInstanceOf(AccessErrorClass);

    await data.resolveAlert(A.teacher, alert!.id);
    const active = await data.listAlerts(A.admin, "ACTIVE");
    expect(active.find((a) => a.id === alert!.id)).toBeUndefined();
    const resolved = await data.listAlerts(A.admin, "RESOLVED");
    expect(resolved.find((a) => a.id === alert!.id)).toBeDefined();
  });

  it("another academy never sees these alerts", async () => {
    const bAlerts = await data.listAlerts(B.admin, "ACTIVE");
    expect(bAlerts.every((a) => a.academyId === B.admin.academyId)).toBe(true);
  });
});

describe("subject-wise attendance", () => {
  it("the same class and day can hold one sheet per subject, kept separate", async () => {
    const maths = await data.addSubject(A.admin, A.classId, "Maths Sub");
    const english = await data.addSubject(A.admin, A.classId, "English Sub");
    const student = await db.student.findFirst({ where: { academyId: A.admin.academyId, rollNumber: "1" } });
    const day = "2027-02-02";
    await data.saveAttendance(A.teacher, A.classId, day, [{ studentId: student!.id, status: "PRESENT" }], { subjectId: maths.id });
    await data.saveAttendance(A.teacher, A.classId, day, [{ studentId: student!.id, status: "ABSENT" }], { subjectId: english.id });

    const m = await data.getAttendanceSheet(A.teacher, A.classId, day, maths.id);
    const e = await data.getAttendanceSheet(A.teacher, A.classId, day, english.id);
    expect(m.students.find((s) => s.id === student!.id)?.status).toBe("PRESENT");
    expect(e.students.find((s) => s.id === student!.id)?.status).toBe("ABSENT");
  });

  it("a subject from another class is rejected", async () => {
    const other = await db.subject.create({ data: { academyId: B.admin.academyId, classId: B.classId, name: "Other" } });
    await expect(data.getAttendanceSheet(A.teacher, A.classId, "2027-02-02", other.id)).rejects.toBeInstanceOf(AccessErrorClass);
  });
});
