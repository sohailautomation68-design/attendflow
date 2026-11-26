# attendflow — Planning Pack

Status: MVP built and verified locally. Written from the brief (no PRD file was attached — see §0).

---

## 0. PRD review: gaps and technical problems

**Input gap:** The message says a complete PRD was provided, but no PRD file or text was included, and none was found on this computer (searched Desktop, Downloads and the project folder for "ClassPulse" / "PRD"). I built from the brief in the request. **Please paste or attach the PRD** so we can check every requirement against this plan.

Problems I identified from the brief, and how the MVP handles each:

| # | Gap / risk | Impact | How handled |
|---|---|---|---|
| 1 | No PRD available | Requirements may differ | Built from brief; reconcile when PRD arrives |
| 2 | Name mismatch (ClassPulse vs attendflow) | Branding | Using **attendflow** as you asked |
| 3 | Classroom Wi-Fi is often unreliable | Lost attendance | Marks saved in browser draft; re-tap Save on failure. Full offline queue is roadmap (Phase 2) |
| 4 | Dates across time zones | Wrong day recorded | Dates calculated in `APP_TIMEZONE` (set to Asia/Karachi — **please confirm**). Per-academy timezone is roadmap |
| 5 | Multi-tenant isolation | Data leak between academies | Academy ID taken only from the server session; every query filtered; 12 automated tests prove cross-academy access is blocked |
| 6 | No password reset | Locked-out users need admin help | **Not in MVP.** Admin can create accounts; reset-by-email needs an email provider (Phase 2) |
| 7 | No login rate limiting | Password guessing | **Not in MVP.** Required before public launch (Phase 2) |
| 8 | SQLite for local dev | Not production-grade | Prisma schema is database-neutral; switch to PostgreSQL before launch (see DEPLOYMENT) |
| 9 | Student data is sensitive (children) | Privacy/compliance | Only name, roll number, optional guardian phone stored. Data-protection review needed (see §8) |
| 10 | Accidental edits to past attendance | Disputes | Any change overwrites with no history. Audit log is Phase 2 |
| 11 | Removing a student | Lost history | Students are deactivated, not deleted; history is kept |

---

## 1. Technical architecture

```
 Teacher phone / laptop (browser)
        │  HTTPS
        ▼
 ┌────────────────────────────────────────────┐
 │ Next.js 15 (App Router, TypeScript)        │
 │  • Pages (server-rendered, mobile-first)   │
 │  • Server Actions (validated with zod)     │
 │  • Session: signed httpOnly JWT cookie     │
 │  • lib/data.ts  ← ALL data access goes     │
 │    through tenant-scoped functions         │
 └────────────────────┬───────────────────────┘
                      │ Prisma ORM
                      ▼
 ┌────────────────────────────────────────────┐
 │ Database: SQLite (dev) → PostgreSQL (prod) │
 └────────────────────────────────────────────┘
```

Why this stack (for a beginner-friendly, maintainable product):
- **Next.js + TypeScript**: one codebase for pages and server logic; the most common modern web stack, with lots of help available.
- **Server-side authorisation**: the browser never decides which academy or class it can see.
- **Prisma**: safe, typed database queries; easy migrations.
- **Tailwind**: fast, consistent mobile layouts.

Key design decisions:
1. **Attendance is saved per class per day** in one transaction — fast and all-or-nothing.
2. **Mobile-first attendance screen**: big 48px+ buttons, one-tap "mark all present", sticky save bar, local draft.
3. **Sessions are re-checked against the database on every request**, so a deactivated user loses access immediately.
4. **Passwords** hashed with bcrypt (cost 12). Login errors do not reveal whether an email exists.

---

## 2. Database relationship diagram

```mermaid
erDiagram
    ACADEMY ||--o{ USER : "has staff"
    ACADEMY ||--o{ CLASS : "owns"
    ACADEMY ||--o{ STUDENT : "enrols"
    ACADEMY ||--o{ ATTENDANCE_SESSION : "records"
    USER ||--o{ CLASS : "teaches (teacherId)"
    USER ||--o{ ATTENDANCE_SESSION : "marked by"
    CLASS ||--o{ STUDENT : "has"
    CLASS ||--o{ ATTENDANCE_SESSION : "has one per date"
    ATTENDANCE_SESSION ||--o{ ATTENDANCE_RECORD : "contains"
    STUDENT ||--o{ ATTENDANCE_RECORD : "marked in"
```

Every table except the relationship tables carries `academyId`, so tenant filters can always be applied.

---

## 3. Database schema

| Table | Key columns | Constraints |
|---|---|---|
| `Academy` | id, name, createdAt | — |
| `User` | id, **academyId**, email, name, passwordHash, role (`ADMIN`/`TEACHER`), active | email unique globally |
| `Class` | id, **academyId**, name, subject, teacherId (nullable) | index on academyId |
| `Student` | id, **academyId**, classId, fullName, rollNumber, guardianPhone, active | unique (classId, rollNumber) |
| `AttendanceSession` | id, **academyId**, classId, date (`YYYY-MM-DD`), markedById, updatedAt | unique (classId, date) |
| `AttendanceRecord` | id, **academyId**, sessionId, studentId, status (`PRESENT`/`ABSENT`/`LATE`/`LEAVE`) | unique (sessionId, studentId) |

The full definition is in [prisma/schema.prisma](../prisma/schema.prisma).

---

## 4. User permission matrix

Roles: **Admin** (owner of an academy, can create and manage), **Teacher** (only classes assigned to them).

| Action | Admin | Teacher | Other academy | Notes |
|---|:-:|:-:|:-:|---|
| Create academy (sign-up) | ✅ | — | — | Creator becomes Admin |
| Sign in / out | ✅ | ✅ | ✅ | Own account only |
| View all classes in academy | ✅ | ❌ | ❌ | Teachers see only their own |
| View a class | ✅ | ✅ (assigned only) | ❌ | Other academies always get "Not found" |
| Create class | ✅ | ❌ | ❌ | |
| Assign teacher to class | ✅ | ❌ | ❌ | Teacher must belong to same academy |
| Add / remove student | ✅ | ✅ add (assigned) / ❌ remove | ❌ | Removal is admin-only |
| Take / save attendance | ✅ | ✅ (assigned) | ❌ | Student IDs checked against class |
| View attendance report | ✅ | ✅ (assigned) | ❌ | |
| Create teacher accounts | ✅ | ❌ | ❌ | |
| Edit past attendance | ✅ | ✅ (assigned) | ❌ | Audit log = Phase 2 |

Enforcement: [lib/data.ts](../lib/data.ts) (`assertClassAccess`, role checks) and [lib/session.ts](../lib/session.ts) (`requireAdmin`). Tested in [tests/tenant-isolation.test.ts](../tests/tenant-isolation.test.ts).

---

## 5. Complete list of application screens

| # | Screen | Route | Who | Status |
|---|---|---|---|---|
| 1 | Sign in | `/login` | Public | ✅ Built |
| 2 | Create academy (sign-up) | `/signup` | Public | ✅ Built |
| 3 | Home (redirects) | `/` | All | ✅ Built |
| 4 | Dashboard — class cards with "Marked today" status | `/dashboard` | All | ✅ Built |
| 5 | **Take attendance (mobile sheet)** | `/attendance/[classId]` | Admin, assigned teacher | ✅ Built |
| 6 | Create class | `/classes/new` | Admin | ✅ Built |
| 7 | Manage class — teacher, students | `/classes/[classId]` | Admin | ✅ Built |
| 8 | Attendance report | `/reports/[classId]` | Admin, assigned teacher | ✅ Built |
| 9 | Teachers — list and add | `/teachers` | Admin | ✅ Built |
| 10 | Edit teacher / reset password | `/teachers/[id]` | Admin | ⏳ Phase 2 |
| 11 | Academy settings (name, timezone) | `/settings` | Admin | ⏳ Phase 2 |
| 12 | Forgot password | `/forgot-password` | Public | ⏳ Phase 2 |
| 13 | Student profile & history | `/students/[id]` | Admin, teacher | ⏳ Phase 2 |

---

## 6. UI/UX design plan

**Principles for teachers:** one tap per student, no hunting for buttons, works with one hand, works in bright sunlight, never loses data.

- **Attendance sheet**: four large status buttons per student — Present (P), Absent (A), Late (L), Leave (Lv). Tapping the same button again clears it. A "Mark all unmarked as Present" button covers the usual case. Running totals sit at the top; "Save attendance" is always visible at the bottom above the phone's home bar.
- **Colours**: green = present, red = absent, amber = late, blue = leave — the same everywhere, including reports.
- **Targets**: all tappable items at least 44–48px high.
- **Feedback**: saved / failed messages appear directly above the save button. Failed saves keep marks on screen.
- **Date**: defaults to today; teachers can pick a past date to fill in missed days.
- **Light theme only** for now (bright classrooms); dark mode is later.
- **Layout**: single column on phones, two columns for class cards and admin forms on tablets and laptops.

---

## 7. Development roadmap

| Phase | Scope | Status |
|---|---|---|
| **0. Planning** | This document; PRD reconciliation | 🟡 Waiting for PRD |
| **1. MVP (attendance core)** | Accounts, academies, classes, students, teachers, mobile attendance, reports, tenant isolation tests | ✅ Done (this build) |
| **2. Launch readiness** | Login rate limiting, password reset by email, PostgreSQL, hosting, backups, error monitoring, academy timezone | ⏳ Next |
| **3. Reliability** | Full offline queue with sync, attendance audit log, "edited by" history | ⏳ |
| **4. Growth** | Guardian SMS/WhatsApp absence alerts, CSV export, bulk student import, low-attendance warnings | ⏳ |
| **5. Scale** | PostgreSQL row-level security as second line of tenant defence, subscription billing, analytics | ⏳ |

Rule for the MVP: nothing in Phases 2–5 is started until the attendance workflow is proven with real teachers.

---

## 8. Compliance and data notes (to confirm with you)
- Student names and guardian phone numbers are personal data (often about children). Before launch, confirm the country's data-protection rules and write a privacy notice.
- Keep backups and define how long attendance history is kept.
