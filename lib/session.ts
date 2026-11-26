import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "attendflow_session";
const SESSION_DAYS = 7;

export type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT" | "GUARDIAN";

export type CurrentUser = {
  id: string;
  academyId: string;
  academyName: string;
  name: string;
  email: string;
  role: Role;
  studentId: string | null;
};

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

/** Creates a signed, httpOnly session cookie for a user. */
export async function createSession(userId: string, academyId: string) {
  const token = await new SignJWT({ uid: userId, aid: academyId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Returns the logged-in user, or null.
 * The token is verified AND the user is re-read from the database, so a
 * deactivated user or a user whose academy changed loses access immediately.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let uid: unknown;
  let aid: unknown;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    uid = payload.uid;
    aid = payload.aid;
  } catch {
    return null;
  }
  if (typeof uid !== "string" || typeof aid !== "string") return null;

  const user = await db.user.findUnique({
    where: { id: uid },
    include: { academy: true },
  });
  if (!user || !user.active || user.academyId !== aid) return null;
  // A suspended or deactivated academy cannot be used. The platform owner is never blocked by this.
  if (user.role !== "SUPER_ADMIN" && (!user.academy.active || user.academy.subscriptionStatus === "SUSPENDED")) return null;

  return {
    id: user.id,
    academyId: user.academyId,
    academyName: user.academy.name,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    studentId: user.studentId,
  };
}

/** Use in pages/actions that require any logged-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Use in pages/actions that require an academy administrator. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}
