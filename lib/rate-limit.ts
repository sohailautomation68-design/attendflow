import { db } from "@/lib/db";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** True when this email has too many recent failed sign-ins. */
export async function isLoginBlocked(email: string, now: Date = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const failures = await db.loginAttempt.count({ where: { email, createdAt: { gte: since } } });
  return failures >= LOGIN_MAX_FAILURES;
}

export async function recordFailedLogin(email: string) {
  await db.loginAttempt.create({ data: { email } });
}

/** Successful login clears the failure history for that email. */
export async function clearFailedLogins(email: string) {
  await db.loginAttempt.deleteMany({ where: { email } });
}
