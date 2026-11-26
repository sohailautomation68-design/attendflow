import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { pickLang, STRINGS } from "@/lib/i18n";

const testDbPath = path.resolve(__dirname, "..", "prisma", "platform-test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;

type U = { id: string; academyId: string; academyName: string; name: string; email: string; role: any; studentId: string | null };

describe("plans, platform owner, leads, analytics, language", () => {
  let db: typeof import("@/lib/db").db;
  let data: typeof import("@/lib/data");
  let admin: U, platformOwner: U, academyId: string;

  beforeAll(async () => {
    if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
    execSync("npx prisma db push --skip-generate --accept-data-loss", {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
      stdio: "ignore",
    });
    db = (await import("@/lib/db")).db;
    data = await import("@/lib/data");
    const academy = await db.academy.create({ data: { name: "Plan Academy", planCode: "STARTER" } });
    academyId = academy.id;
    const platform = await db.academy.create({ data: { name: "AttendFlow Platform" } });
    const a = await db.user.create({ data: { academyId, email: "a@p.local", name: "Admin", passwordHash: "x", role: "ADMIN" } });
    const p = await db.user.create({ data: { academyId: platform.id, email: "owner@p.local", name: "Owner", passwordHash: "x", role: "SUPER_ADMIN" } });
    admin = { id: a.id, academyId, academyName: "Plan Academy", name: "Admin", email: a.email, role: "ADMIN", studentId: null };
    platformOwner = { id: p.id, academyId: platform.id, academyName: "AttendFlow Platform", name: "Owner", email: p.email, role: "SUPER_ADMIN", studentId: null };
  });

  it("the teacher limit of the plan is enforced", async () => {
    for (let i = 0; i < 5; i++) {
      await db.user.create({ data: { academyId, email: `t${i}@p.local`, name: `T${i}`, passwordHash: "x", role: "TEACHER" } });
    }
    await expect(data.assertWithinPlan(academyId, "teacher")).rejects.toThrow(/allows 5 teachers/);
  });

  it("the platform owner can change plan and status, and the change is audited with a reason", async () => {
    await data.updateAcademyBilling(platformOwner, academyId, { planCode: "STANDARD", subscriptionStatus: "ACTIVE", active: true, reason: "Signed contract" });
    const a = await db.academy.findUnique({ where: { id: academyId } });
    expect(a?.planCode).toBe("STANDARD");
    const log = await db.auditLog.findFirst({ where: { academyId, action: "PLATFORM_BILLING_CHANGED" } });
    expect(log?.reason).toBe("Signed contract");
  });

  it("an academy admin cannot change billing, and a reason is required", async () => {
    await expect(data.updateAcademyBilling(admin, academyId, { planCode: "PROFESSIONAL", subscriptionStatus: "ACTIVE", active: true, reason: "Upgrade please" })).rejects.toThrow();
    await expect(data.updateAcademyBilling(platformOwner, academyId, { planCode: "STANDARD", subscriptionStatus: "ACTIVE", active: true, reason: "" })).rejects.toThrow(/reason/);
  });

  it("the platform list shows counts only and is owner-only", async () => {
    const rows = await data.listAcademiesForPlatform(platformOwner);
    const mine = rows.find((r) => r.id === academyId);
    expect(mine?.teachers).toBe(5);
    expect(Object.keys(mine ?? {})).not.toContain("students_list");
    await expect(data.listAcademiesForPlatform(admin)).rejects.toThrow();
  });

  it("a suspended academy is refused on new student additions", async () => {
    await data.updateAcademyBilling(platformOwner, academyId, { planCode: "STANDARD", subscriptionStatus: "SUSPENDED", active: true, reason: "Unpaid invoice" });
    await expect(data.assertWithinPlan(academyId, "student")).rejects.toThrow(/suspended/);
  });

  it("the public contact form stores valid leads, rejects bad email, and quietly drops honeypot bots", async () => {
    const { saveLead } = await import("@/lib/leads");
    expect(await saveLead({ name: "Sara Khan", email: "not-an-email" })).toMatch(/valid email/);
    expect(await saveLead({ name: "Sara Khan", email: "sara@example.com", message: "Demo please" })).toBeNull();
    expect(await db.lead.count({ where: { email: "sara@example.com" } })).toBe(1);
    expect(await saveLead({ name: "Bot Bot", email: "bot@example.com", website: "http://spam" })).toBeNull();
    expect(await db.lead.count({ where: { email: "bot@example.com" } })).toBe(0);
  });

  it("analytics records only allow-listed event names", async () => {
    const { trackEvent } = await import("@/lib/analytics");
    await trackEvent("signup_completed", academyId);
    // @ts-expect-error testing an unknown event name is ignored at runtime
    await trackEvent("personal_data_leak", academyId);
    expect(await db.analyticsEvent.count({ where: { name: "personal_data_leak" } })).toBe(0);
    expect(await db.analyticsEvent.count({ where: { name: "signup_completed" } })).toBeGreaterThan(0);
  });

  it("language selection defaults to English and supports Urdu with right-to-left direction", () => {
    expect(pickLang(undefined)).toBe("en");
    expect(pickLang("ur")).toBe("ur");
    expect(pickLang("fr")).toBe("en");
    expect(STRINGS.ur.dir).toBe("rtl");
  });
});
