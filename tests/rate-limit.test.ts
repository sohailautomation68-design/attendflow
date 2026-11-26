import { describe, expect, it, beforeAll } from "vitest";
import { setupTestDb } from "./test-db";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";


describe("login rate limiting", () => {
  let isLoginBlocked: typeof import("@/lib/rate-limit").isLoginBlocked;
  let recordFailedLogin: typeof import("@/lib/rate-limit").recordFailedLogin;
  let clearFailedLogins: typeof import("@/lib/rate-limit").clearFailedLogins;
  let LOGIN_MAX_FAILURES: number;

  beforeAll(async () => {
    await setupTestDb();
    const m = await import("@/lib/rate-limit");
    ({ isLoginBlocked, recordFailedLogin, clearFailedLogins, LOGIN_MAX_FAILURES } = m);
  });

  it("blocks after the maximum number of failures within the window", async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) await recordFailedLogin("x@example.com");
    expect(await isLoginBlocked("x@example.com")).toBe(false);
    await recordFailedLogin("x@example.com");
    expect(await isLoginBlocked("x@example.com")).toBe(true);
  });

  it("failures older than the window no longer block", async () => {
    const later = new Date(Date.now() + 16 * 60 * 1000);
    expect(await isLoginBlocked("x@example.com", later)).toBe(false);
  });

  it("a successful login clears the history", async () => {
    await clearFailedLogins("x@example.com");
    expect(await isLoginBlocked("x@example.com")).toBe(false);
  });
});
