-- CreateTable
CREATE TABLE "AbsenceAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "raisedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    CONSTRAINT "AbsenceAlert_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academyId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUpTask_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AbsenceAlert" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AbsenceAlert_academyId_status_idx" ON "AbsenceAlert"("academyId", "status");

-- CreateIndex
CREATE INDEX "AbsenceAlert_studentId_rule_status_idx" ON "AbsenceAlert"("studentId", "rule", "status");

-- CreateIndex
CREATE INDEX "FollowUpTask_academyId_status_idx" ON "FollowUpTask"("academyId", "status");
