"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, requireAdmin, requireUser } from "@/lib/session";
import {
  ATTENDANCE_STATUSES,
  addStudent,
  assignTeacher,
  createClass,
  deactivateStudent,
  saveAttendance,
  EditWindowError,
  previewStudentImport,
  importStudents,
  transferStudent,
  addTimetableEntry,
  deleteTimetableEntry,
  cancelDay,
  restoreDay,
  generateSessionsFromTimetable,
  addSubject,
  deleteSubject,
  evaluateClassAlerts,
  resolveAlert,
  addFollowUp,
  completeFollowUp,
  listAlerts,
  createPortalAccount,
  requestCorrection,
  decideCorrection,
  markAllRead,
  updateAcademyBilling,
  assertWithinPlan,
} from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { saveLead } from "@/lib/leads";
import { trackEvent } from "@/lib/analytics";
import { clearFailedLogins, isLoginBlocked, recordFailedLogin } from "@/lib/rate-limit";

export type ActionState = { error?: string; ok?: string } | undefined;

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

function field(formData: FormData, key: string) {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

/* ---------- Auth ---------- */

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const academyName = z.string().trim().min(2, "Academy name is required").max(120).safeParse(field(formData, "academyName"));
  const name = z.string().trim().min(2, "Your name is required").max(120).safeParse(field(formData, "name"));
  const email = emailSchema.safeParse(field(formData, "email"));
  const password = passwordSchema.safeParse(field(formData, "password"));

  const firstError = [academyName, name, email, password].find((r) => !r.success);
  if (firstError && !firstError.success) return { error: firstError.error.issues[0].message };
  if (!academyName.success || !name.success || !email.success || !password.success) {
    return { error: "Please check the form" };
  }

  const existing = await db.user.findUnique({ where: { email: email.data } });
  if (existing) return { error: "An account with this email already exists" };

  const passwordHash = await bcrypt.hash(password.data, 12);
  const academy = await db.academy.create({
    data: {
      name: academyName.data,
      users: {
        create: { email: email.data, name: name.data, passwordHash, role: "ADMIN" },
      },
    },
    include: { users: true },
  });

  await createSession(academy.users[0].id, academy.id);
  await trackEvent("signup_completed", academy.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(field(formData, "email"));
  const password = z.string().min(1, "Enter your password").safeParse(field(formData, "password"));
  if (!email.success) return { error: email.error.issues[0].message };
  if (!password.success) return { error: password.error.issues[0].message };

  if (await isLoginBlocked(email.data)) return { error: "Too many failed attempts. Wait 15 minutes and try again." };

  const user = await db.user.findUnique({ where: { email: email.data } });
  // Same message for unknown email and wrong password (no account enumeration).
  const valid = user && user.active && (await bcrypt.compare(password.data, user.passwordHash));
  if (!user || !valid) {
    await recordFailedLogin(email.data);
    return { error: "Incorrect email or password" };
  }
  await clearFailedLogins(email.data);

  await createSession(user.id, user.academyId);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/* ---------- Attendance (the core workflow) ---------- */

const saveSchema = z.object({
  classId: z.string().min(1),
  date: dateSchema,
  subjectId: z.string().max(100).optional().default(""),
  entries: z
    .array(z.object({ studentId: z.string().min(1), status: z.enum(ATTENDANCE_STATUSES) }))
    .max(500),
});

/** Called by the teacher's attendance sheet. Input is re-validated on the server. */
export async function saveAttendanceAction(payload: unknown, reason?: string) {
  const user = await requireUser();
  const parsed = saveSchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid attendance data. Please refresh and try again." };

  try {
    const result = await saveAttendance(user, parsed.data.classId, parsed.data.date, parsed.data.entries, {
      subjectId: parsed.data.subjectId,
      reason: typeof reason === "string" ? reason.slice(0, 300) : undefined,
    });
    await evaluateClassAlerts(user, parsed.data.classId, todayISO()).catch(() => undefined);
    await trackEvent("attendance_saved", user.academyId);
    revalidatePath(`/attendance/${parsed.data.classId}`);
    return {
      ok: result.saved
        ? `Saved (${result.saved} change${result.saved === 1 ? "" : "s"})`
        : "Saved — no changes",
    };
  } catch (e) {
    if (e instanceof EditWindowError) {
      if (e.needsReason) return { needsReason: true as const };
      return { error: "The 48-hour edit window for this sheet has closed. Ask an administrator to make the change." };
    }
    return { error: "Could not save. Check your access or try again." };
  }
}

/* ---------- Admin: classes, teachers, students ---------- */

export async function createClassAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const name = z.string().trim().min(2, "Class name is required").max(100).safeParse(field(formData, "name"));
  if (!name.success) return { error: name.error.issues[0].message };
  try {
    await createClass(user, {
      name: name.data,
      subject: field(formData, "subject"),
      teacherId: field(formData, "teacherId") || null,
    });
  } catch {
    return { error: "Could not create class" };
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function assignTeacherAction(classId: string, teacherId: string) {
  const user = await requireAdmin();
  try {
    await assignTeacher(user, classId, teacherId || null);
  } catch {
    return { error: "Could not assign teacher" };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: "Teacher updated" };
}

export async function createTeacherAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const name = z.string().trim().min(2, "Name is required").max(120).safeParse(field(formData, "name"));
  const email = emailSchema.safeParse(field(formData, "email"));
  const password = passwordSchema.safeParse(field(formData, "password"));
  if (!name.success) return { error: name.error.issues[0].message };
  if (!email.success) return { error: email.error.issues[0].message };
  if (!password.success) return { error: password.error.issues[0].message };

  if (await db.user.findUnique({ where: { email: email.data } })) {
    return { error: "An account with this email already exists" };
  }
  try {
    await assertWithinPlan(user.academyId, "teacher");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Teacher limit reached" };
  }
  await db.user.create({
    data: {
      academyId: user.academyId,
      name: name.data,
      email: email.data,
      passwordHash: await bcrypt.hash(password.data, 12),
      role: "TEACHER",
    },
  });
  revalidatePath("/teachers");
  return { ok: "Teacher account created. Share the email and password with them securely." };
}

export async function addStudentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const classId = field(formData, "classId");
  const fullName = z.string().trim().min(2, "Student name is required").max(120).safeParse(field(formData, "fullName"));
  const rollNumber = z.string().trim().min(1, "Roll number is required").max(30).safeParse(field(formData, "rollNumber"));
  if (!fullName.success) return { error: fullName.error.issues[0].message };
  if (!rollNumber.success) return { error: rollNumber.error.issues[0].message };
  try {
    await addStudent(user, classId, {
      fullName: fullName.data,
      rollNumber: rollNumber.data,
      guardianPhone: field(formData, "guardianPhone"),
    });
  } catch (e) {
    const message = e instanceof Error && e.message.includes("Unique") ? "That roll number already exists in this class" : "Could not add student";
    return { error: message };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: "Student added" };
}

export async function deactivateStudentAction(studentId: string, classId: string) {
  const user = await requireAdmin();
  try {
    await deactivateStudent(user, studentId);
  } catch {
    return { error: "Could not remove student" };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: "Student removed from the active roster (attendance history is kept)" };
}

/* ---------- Admin/teacher: CSV import and class transfer ---------- */

export async function previewImportAction(classId: string, csvText: string) {
  const user = await requireUser();
  try {
    return await previewStudentImport(user, classId, csvText);
  } catch {
    return { rows: [], issues: [{ line: 0, message: "You do not have access to this class." }] };
  }
}

export async function importStudentsAction(classId: string, csvText: string) {
  const user = await requireUser();
  try {
    const result = await importStudents(user, classId, csvText);
    revalidatePath(`/classes/${classId}`);
    return result;
  } catch {
    return { imported: 0, issues: [{ line: 0, message: "Import failed. Nothing was saved." }] };
  }
}

export async function transferStudentAction(studentId: string, toClassId: string, classId: string) {
  const user = await requireAdmin();
  try {
    await transferStudent(user, studentId, toClassId);
  } catch (e) {
    const message = e instanceof Error && e.message.includes("Unique") ? "That roll number is already used in the new class" : "Could not transfer student";
    return { error: message };
  }
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/classes/${toClassId}`);
  return { ok: "Student transferred. Earlier attendance stays with the old class." };
}

/* ---------- Timetable and cancelled days ---------- */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export async function addTimetableAction(classId: string, weekday: number, startTime: string, endTime: string) {
  const user = await requireAdmin();
  const parsed = z.object({ weekday: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm }).safeParse({ weekday, startTime, endTime });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await addTimetableEntry(user, classId, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add the timetable slot" };
  }
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/dashboard");
  return { ok: "Timetable slot added" };
}

export async function deleteTimetableAction(entryId: string, classId: string) {
  const user = await requireAdmin();
  try {
    await deleteTimetableEntry(user, entryId);
  } catch {
    return { error: "Could not remove the slot" };
  }
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/dashboard");
  return { ok: "Slot removed" };
}

export async function cancelDayAction(classId: string, date: string, reason: string) {
  const user = await requireAdmin();
  try {
    await cancelDay(user, classId, date, reason.slice(0, 200));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not cancel the day" };
  }
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/dashboard");
  return { ok: `${date} marked as cancelled. It will not count as absence.` };
}

export async function restoreDayAction(classId: string, date: string) {
  const user = await requireAdmin();
  try {
    await restoreDay(user, classId, date);
  } catch {
    return { error: "Could not restore the day" };
  }
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/dashboard");
  return { ok: `${date} is back on the schedule` };
}

/* ---------- Session generation, subjects ---------- */

export async function generateSessionsAction(classId: string, from: string, to: string) {
  const user = await requireAdmin();
  try {
    const r = await generateSessionsFromTimetable(user, classId, from, to);
    revalidatePath("/dashboard");
    return { ok: `Created ${r.created} open session(s). Mark attendance on each day.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate sessions" };
  }
}

export async function addSubjectAction(classId: string, name: string) {
  const user = await requireAdmin();
  try {
    await addSubject(user, classId, name);
  } catch (e) {
    const message = e instanceof Error && e.message.includes("Unique") ? "That subject already exists" : e instanceof Error ? e.message : "Could not add subject";
    return { error: message };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: "Subject added" };
}

export async function deleteSubjectAction(subjectId: string, classId: string) {
  const user = await requireAdmin();
  try {
    await deleteSubject(user, subjectId);
  } catch {
    return { error: "Could not remove subject" };
  }
  revalidatePath(`/classes/${classId}`);
  return { ok: "Subject removed" };
}

/* ---------- Absence alerts and follow-up (Phase 4) ---------- */

export async function resolveAlertAction(alertId: string) {
  const user = await requireUser();
  try {
    await resolveAlert(user, alertId);
  } catch {
    return { error: "Could not resolve the alert" };
  }
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
  return { ok: "Alert resolved" };
}

export async function addFollowUpAction(alertId: string, assignedToId: string, dueDate: string, notes: string) {
  const user = await requireAdmin();
  try {
    await addFollowUp(user, alertId, { assignedToId, dueDate, notes });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add follow-up" };
  }
  revalidatePath("/alerts");
  return { ok: "Follow-up task created" };
}

export async function completeFollowUpAction(taskId: string, reason: string, notes: string) {
  const user = await requireUser();
  try {
    await completeFollowUp(user, taskId, reason, notes);
  } catch {
    return { error: "Could not complete the follow-up" };
  }
  revalidatePath("/alerts");
  return { ok: "Follow-up completed" };
}

/* ---------- Portals, corrections, notifications ---------- */

export async function createPortalAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const role = field(formData, "role");
  if (role !== "STUDENT" && role !== "GUARDIAN") return { error: "Choose Student or Guardian" };
  const name = z.string().trim().min(2, "Name is required").max(120).safeParse(field(formData, "name"));
  const email = emailSchema.safeParse(field(formData, "email"));
  const password = passwordSchema.safeParse(field(formData, "password"));
  if (!name.success) return { error: name.error.issues[0].message };
  if (!email.success) return { error: email.error.issues[0].message };
  if (!password.success) return { error: password.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: email.data } })) return { error: "An account with this email already exists" };
  try {
    await createPortalAccount(user, {
      role,
      name: name.data,
      email: email.data,
      passwordHash: await bcrypt.hash(password.data, 12),
      studentId: field(formData, "studentId"),
      consent: field(formData, "consent") === "yes",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the account" };
  }
  revalidatePath("/students");
  return { ok: "Login created. Share the email and password with them securely." };
}

export async function requestCorrectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const status = field(formData, "requestedStatus");
  if (!(ATTENDANCE_STATUSES as readonly string[]).includes(status)) return { error: "Choose a status" };
  try {
    await requestCorrection(user, field(formData, "studentId"), field(formData, "date"), status as (typeof ATTENDANCE_STATUSES)[number], field(formData, "reason"));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not send the request" };
  }
  revalidatePath("/me");
  return { ok: "Request sent to the academy" };
}

export async function decideCorrectionAction(requestId: string, approve: boolean, note: string) {
  const user = await requireAdmin();
  try {
    await decideCorrection(user, requestId, approve, note);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the decision" };
  }
  revalidatePath("/corrections");
  return { ok: approve ? "Correction approved and applied" : "Correction declined" };
}

export async function markAllReadAction() {
  const user = await requireUser();
  await markAllRead(user);
  revalidatePath("/notifications");
  return { ok: true };
}

export async function updateAcademyBillingAction(
  academyId: string,
  input: { planCode: string; subscriptionStatus: string; active: boolean; reason: string },
) {
  const user = await requireUser();
  try {
    await updateAcademyBilling(user, academyId, input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
  revalidatePath("/platform");
  return { ok: "Saved and logged" };
}

export async function submitLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const error = await saveLead({
    name: field(formData, "name"),
    email: field(formData, "email"),
    academyName: field(formData, "academyName"),
    message: field(formData, "message"),
    website: field(formData, "website"),
  });
  if (error) return { error };
  return { ok: "Thank you. We will reply to your email within two working days." };
}
