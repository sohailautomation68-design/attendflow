# AttendFlow PRD Review and Technical Decisions

Reviewed against the current build (Next.js 15 + Prisma + SQLite, MVP in `app/`, `lib/`, `components/`). Decisions below are final unless you object. Items marked **DECISION NEEDED** block only deployment, not development.

## 1. Decisions I made (so development can proceed)

| Topic | PRD says | Decision | Why |
|---|---|---|---|
| Frontend + backend | React + Vite (marketing) + Supabase | **Keep one Next.js app** for marketing pages, dashboard and server logic | Security checks run on the server, not in the browser. One codebase is easier for a beginner. Already built and working. |
| Database | Supabase PostgreSQL | **PostgreSQL** (Supabase-hosted or other managed Postgres) via Prisma. SQLite stays for local dev only | Same Prisma schema; switching is a config change. Postgres is what the PRD requires. |
| Auth | Supabase Auth | **Keep custom email/password auth** (bcrypt + signed cookie) for now | Already working and tested. Revisit only if we need social login or email verification at scale. |
| Tenant security | Application filtering + PostgreSQL Row Level Security | **Application filtering now** (done, tested) + **RLS in Phase 6** as a second layer | RLS is required by PRD §12. It needs a Postgres database first; adding it now would block progress. |
| Charts | "a lightweight library" | **Recharts** (added in Phase 3) | Common, well documented. |
| Forms | "schema validation library" | **zod** (already used) | Already in place. |
| QR codes | Optional | **Deferred** (PRD Phase 7) | Not in MVP. |
| Hosting | Hostinger (beginner) | **DECISION NEEDED** — see §5 | Shared Hostinger plans may not run a persistent Node.js server. |

## 2. Gaps and contradictions in the PRD

1. **Roles are incomplete in the database.** PRD §4 lists 5 roles (Super Admin, Owner, Teacher, Student, Guardian). Current `User.role` only supports `ADMIN` and `TEACHER`. Add `SUPER_ADMIN`, `STUDENT`, `GUARDIAN`, plus a separate `Guardian`↔`Student` link table.
2. **Missing entities** from PRD §11: `academic_sessions`, `subjects`, `teacher_assignments`, `timetable_entries`, `student_enrollments` (with history for batch moves), `absence_alerts`, `follow_up_tasks`, `notifications`, `audit_logs`, `profiles`/`organization_members` split. The MVP schema has none of these.
3. **Attendance percentage rules are undefined in the PRD for some cases.** Defaults I will use (configurable per academy):
   - Present and Late count as attended (PRD default).
   - Excused Leave is **excluded from the denominator** (not counted as absent). PRD says "configurable", so this is a choice to confirm.
   - Cancelled and holiday sessions are excluded entirely.
   - Sessions before enrollment start or after enrollment end are excluded.
4. **Alert thresholds have example values only.** Defaults: 3 consecutive absences; below 75%; 5 absences in 30 days. All configurable.
5. **"Consecutive absence" is not defined per session vs per calendar day.** Decision: consecutive *attended-session* count, ordered by session date within that student's enrollment.
6. **Edit window is undefined** (PRD §8: "configured edit window"). Default: teachers may edit their own submitted sessions for 48 hours; after that only admins, with a reason and audit record.
7. **Timetable → session generation rules are undefined** (PRD §7). Decision: generate sessions per weekday entry for a date range; a cancelled or holiday date creates no absence records; duplicates prevented by a unique key on (batch, subject, date, start time).
8. **Parent/guardian consent** is required for notifications (PRD §10, §12) but no consent field exists. Add `guardian_consent_at` on guardian links; notifications skip students without consent.
9. **"Mark everyone present" + "Submit" + "Edit window"** interact. Decision: a session starts as `DRAFT` (autosaved), `SUBMITTED` when the teacher confirms, and edits after submit go through the edit rules above.
10. **Public website needs a backend for "Book a Demo" and contact form.** Decision: store submissions in a `leads` table and email the owner; spam protection (honeypot + rate limit) required.
11. **Pricing is experimental (PRD §9).** Plans must be stored as data (table `plans`), not hard-coded. Billing is manual activation in Phase 1; no card data stored.
12. **Urdu / right-to-left** is "future" but the architecture note asks to support it. Decision: use logical CSS properties (`ms-`, `me-`) and keep all strings in one file, so Urdu can be added later without rework.
13. **Student portal and parent portal overlap** (correction requests appear in both). Decision: build the student portal in Phase 5; parent portal is Phase 7.
14. **Data retention** has no period defined. **DECISION NEEDED**: how many years to keep attendance records after a student leaves (I suggest 5 years, to confirm with your legal advice).
15. **SEO vs private data:** dashboard routes must send `noindex` and be excluded from the sitemap.

## 3. Technical risks

| Risk | Mitigation |
|---|---|
| Tenant leak through a missed filter | Every query goes through `lib/data.ts`; automated tests (done, 12 passing); RLS in Phase 6; code review rule: no direct `db.` calls outside `lib/data`. |
| Child data exposure | Minimal fields; no public student URLs (use IDs that are not guessable, plus auth check); exports require admin role. |
| Duplicate attendance on flaky networks | Unique (session, student) key (done); idempotent save; draft kept on device (done). |
| Alert spam | Alerts keyed by (student, rule, active period); recomputed, never re-inserted. |
| Hosting incompatibility | See §5. |
| Attendance miscalculation | One calculation service used by dashboard, alerts and reports; unit tests with fixed scenarios (Phase 3). |
| SQLite → Postgres differences | Avoid SQLite-only features; use Prisma migrations from Phase 2 onward instead of `db push`. |

## 4. Unnecessary features for the MVP (defer)

Defer: parent portal, WhatsApp/SMS, QR attendance, biometric, offline mode (the local draft is enough for now), multiple branches, payment gateway, PDF export, Urdu UI, student-side correction workflow (Phase 5), advanced engagement analytics, website blog/SEO landing pages beyond the core pages.

Keep in MVP: accounts and tenant isolation, students, teachers, classes/batches, enrollments, timetable-driven sessions, mobile attendance with edit rules, percentages, absence alerts with follow-up, CSV export, basic dashboard, privacy and terms pages, a simple pricing page.

## 5. DECISION NEEDED — hosting

Before deployment, tell me which you can use:

- **Option A (recommended): Vercel for the app + managed PostgreSQL (Supabase).** Free tier is enough for testing. Your Hostinger domain can point to it. Works with this code without changes.
- **Option B: Hostinger VPS (Ubuntu) running Node.js.** Full control, monthly cost, you must maintain the server.
- **Option C: Hostinger shared / web hosting.** I need to confirm the exact plan supports a persistent Node.js app before recommending it. I cannot verify your plan from here, so please check your plan's features page or send me the plan name.

## 6. Phase plan (this build)

| Phase | Scope | Status |
|---|---|---|
| 0. Planning | Architecture, schema, permissions, screens, UI/UX, this review | Done (`docs/PLANNING.md` + this file). Update `PLANNING.md` roles/schema in Phase 2. |
| 1. Foundation | Auth, academy isolation, roles, setup | Mostly done; add SUPER_ADMIN role, academy setup checklist |
| 2. Core management | Students, teachers, classes, enrollments with history, transfers, CSV import with preview and all-or-nothing save, Prisma migrations | **Mostly done** (tests: 21 passing). Remaining: subjects (not started), batch vs class naming, SUPER_ADMIN/STUDENT/GUARDIAN roles, Postgres switch (waits on hosting) |
| 3. Attendance | Timetable, session generation, draft/submit/edit-window, audit log, percentage service with tests | **Mostly done** (tests: 43 passing). Done: submit state, 48h edit window, admin correction with reason, audit log and audit page, weekly slots, cancelled days, today schedule, shared percentage service, open-day generation from timetable (with button), dashboard Needs attendance list, subjects (names only). Remaining: subject-wise attendance and reports, session status for teacher drafts, excused/late reports polish |
| 4. Absence management | Alert rules, dedup, alert dashboard, follow-up tasks, in-app notifications, email later | |
| 5. Reporting | Daily/weekly/monthly/student/batch reports, CSV/Excel export, student portal | |
| 6. Finalization | RLS, security tests, responsive QA, backups, deployment docs, privacy and terms pages, public site | |
| 7. Future | Parent portal, WhatsApp/SMS, QR, offline, branches | Not started |

## 7. What I need from you next

1. **Hosting choice** (§5).
2. Confirm the default rules in §2 items 3–5 and 14 (excused handling, alert thresholds, retention).
3. Whether you want a Supabase project created for the database. If yes, I will tell you exactly what to click; I will not ask for passwords or keys. You paste only the connection string into `.env` locally.

Next action from me, once you answer: Phase 2 (roles, enrollments, CSV import, Postgres migrations), then Phase 3.

## 8. Status after the final round

- Phase 4 absence alerts: rules (3 consecutive, below 75%, 5 in 30 days), one active alert per student+rule, resolve, follow-up tasks with reasons. Done.
- Phase 5 reports: CSV download, preset ranges (today, 7 days, this month). Done. Excel-specific export not done (CSV opens in Excel).
- Phase 6: login rate limiting (5 failures per 15 min), draft privacy and terms pages, public home page. Partly done.
- Blocked on hosting decision: PostgreSQL switch, row-level security, deployment, backups, error monitoring.
- Blocked on an email provider: password reset, email notifications.
- Not started: subject-wise attendance, in-app notification list (alerts page and dashboard panel exist).
- Legal pages are drafts and need a lawyer review.

## 9. Final status (full build, before database connection)

Built and tested: attendance (sheets, drafts, subjects, 48h edit window, audit), timetable, cancelled days, generated days, alerts with follow-up, notifications, reports and CSV, student profile, CSV import with template, dashboard trend chart and setup checklist, student and guardian portals with correction requests, plans and limits, platform owner page, public pages (home, features, pricing, FAQ, about, contact and demo form, privacy, terms), sitemap and robots, privacy-conscious analytics, English and Urdu home page.

Needs your action: database connection (PostgreSQL), hosting, deployment, backups, error monitoring, email provider (password reset and email), legal review of the privacy policy and terms, and creating the platform owner with scripts/create-super-admin.mjs.

Known limits: Urdu covers the home page only; the app is English. Excel is CSV. Messaging (WhatsApp, SMS), payments and QR attendance are not built. Offline mode is a device draft only.
