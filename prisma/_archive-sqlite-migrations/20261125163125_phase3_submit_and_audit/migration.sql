-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AttendanceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academyId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "markedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceSession_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "Academy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceSession_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceSession_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AttendanceSession" ("academyId", "classId", "createdAt", "date", "id", "markedById", "updatedAt") SELECT "academyId", "classId", "createdAt", "date", "id", "markedById", "updatedAt" FROM "AttendanceSession";
DROP TABLE "AttendanceSession";
ALTER TABLE "new_AttendanceSession" RENAME TO "AttendanceSession";
CREATE INDEX "AttendanceSession_academyId_idx" ON "AttendanceSession"("academyId");
CREATE UNIQUE INDEX "AttendanceSession_classId_date_key" ON "AttendanceSession"("classId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_academyId_createdAt_idx" ON "AuditLog"("academyId", "createdAt");
