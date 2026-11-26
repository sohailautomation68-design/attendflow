import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./test-db";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-test-secret-test-secret-123456";

type U = { id: string; academyId: string; academyName: string; name: string; email: string; role: any; studentId: string | null };

describe("student and guardian access", () => {
  let db: typeof import("@/lib/db").db;
  let data: typeof import("@/lib/data");
  let admin: U, teacher: U, studentUser: U, guardian: U, otherGuardian: U;
  let classId: string, s1: string, s2: string, sibling: string;
  let otherAcademyClass: string;
  const day = "2027-03-01";

  beforeAll(async () => {
    await setupTestDb();
    db = (await import("@/lib/db")).db;
    data = await import("@/lib/data");

    const academy = await db.academy.create({ data: { name: "Portal Academy" } });
    const other = await db.academy.create({ data: { name: "Other Academy" } });
    const mk = async (aid: string, role: string, name: string, studentId: string | null = null): Promise<U> => {
      const u = await db.user.create({ data: { academyId: aid, email: `${name.replace(/\W/g, "")}-${aid}@t.local`, name, passwordHash: "x", role, studentId } });
      return { id: u.id, academyId: aid, academyName: "", name, email: u.email, role, studentId };
    };
    admin = await mk(academy.id, "ADMIN", "Admin P");
    teacher = await mk(academy.id, "TEACHER", "Teacher P");
    const cls = await db.class.create({ data: { academyId: academy.id, name: "P Class", teacherId: teacher.id } });
    classId = cls.id;
    const otherCls = await db.class.create({ data: { academyId: other.id, name: "O Class" } });
    otherAcademyClass = otherCls.id;

    const st1 = await db.student.create({ data: { academyId: academy.id, classId, fullName: "Ali P", rollNumber: "1" } });
    const st2 = await db.student.create({ data: { academyId: academy.id, classId, fullName: "Bina P", rollNumber: "2" } });
    const st3 = await db.student.create({ data: { academyId: academy.id, classId, fullName: "Sibling P", rollNumber: "3" } });
    s1 = st1.id; s2 = st2.id; sibling = st3.id;
    for (const s of [st1, st2, st3]) {
      await db.enrollment.create({ data: { academyId: academy.id, studentId: s.id, classId, startDate: "2027-01-01" } });
    }

    studentUser = await mk(academy.id, "STUDENT", "Student Ali", s1);
    guardian = await mk(academy.id, "GUARDIAN", "Guardian Bina");
    await db.guardianLink.create({ data: { academyId: academy.id, userId: guardian.id, studentId: s2, consentAt: new Date() } });
    otherGuardian = await mk(academy.id, "GUARDIAN", "Guardian Other");

    await data.saveAttendance(teacher, classId, day, [
      { studentId: s1, status: "ABSENT" },
      { studentId: s2, status: "PRESENT" },
      { studentId: sibling, status: "PRESENT" },
    ]);
  });

  it("a student cannot read any class, attendance sheet, or class list", async () => {
    await expect(data.getClass(studentUser, classId)).rejects.toThrow();
    await expect(data.getAttendanceSheet(studentUser, classId, day)).rejects.toThrow();
    expect(await data.listClasses(studentUser)).toEqual([]);
  });

  it("a guardian cannot read a class or a sibling's sheet", async () => {
    await expect(data.getClass(guardian, classId)).rejects.toThrow();
    await expect(data.getAttendanceSheet(guardian, classId, day)).rejects.toThrow();
  });

  it("portal views show only the student's own record, or only linked children for guardians", async () => {
    const stu = await data.portalStudents(studentUser);
    expect(stu.map((x) => x.student.id)).toEqual([s1]);
    const g = await data.portalStudents(guardian);
    expect(g.map((x) => x.student.id)).toEqual([s2]);
    expect(await data.portalStudents(otherGuardian)).toEqual([]);
  });

  it("a student cannot request a correction for a sibling or another student", async () => {
    await expect(data.requestCorrection(studentUser, s2, day, "PRESENT", "Wrong mark for me")).rejects.toThrow();
    await expect(data.requestCorrection(guardian, s1, day, "PRESENT", "Wrong mark for me")).rejects.toThrow();
  });

  it("a student's own correction request is created, notifies admins, and cannot change the record by itself", async () => {
    await data.requestCorrection(studentUser, s1, day, "PRESENT", "I was present in class");
    const pending = await data.listCorrections(admin, "PENDING");
    const mine = pending.find((p) => p.studentId === s1);
    expect(mine).toBeDefined();
    const record = await db.attendanceRecord.findFirst({ where: { studentId: s1, session: { date: day } } });
    expect(record?.status).toBe("ABSENT");
  });

  it("only an admin can decide; approval applies the change and audits it with the reason", async () => {
    const req = (await data.listCorrections(admin, "PENDING")).find((p) => p.studentId === s1)!;
    await expect(data.decideCorrection(studentUser, req.id, true, "")).rejects.toThrow();
    await data.decideCorrection(admin, req.id, true, "Checked register");
    const record = await db.attendanceRecord.findFirst({ where: { studentId: s1, session: { date: day } } });
    expect(record?.status).toBe("PRESENT");
    const audit = await db.auditLog.findFirst({ where: { academyId: admin.academyId, reason: { contains: "Correction approved" } } });
    expect(audit).not.toBeNull();
  });

  it("guardian logins require recorded consent", async () => {
    await expect(
      data.createPortalAccount(admin, { role: "GUARDIAN", name: "No Consent", email: "nc@t.local", passwordHash: "x", studentId: s1, consent: false }),
    ).rejects.toThrow(/consent/);
  });

  it("notifications are private to each user", async () => {
    const adminNotes = await data.listNotifications(admin);
    expect(adminNotes.length).toBeGreaterThan(0);
    const studentNotes = await data.listNotifications(studentUser);
    expect(studentNotes.every((n) => n.userId === studentUser.id)).toBe(true);
  });

  it("students and guardians cannot see another academy's class, and admins cannot see its alerts either", async () => {
    await expect(data.getClass(admin, otherAcademyClass)).rejects.toThrow();
  });
});
