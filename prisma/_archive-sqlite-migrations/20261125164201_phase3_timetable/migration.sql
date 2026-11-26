-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academyId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimetableEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CancelledDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academyId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CancelledDay_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TimetableEntry_academyId_idx" ON "TimetableEntry"("academyId");

-- CreateIndex
CREATE INDEX "TimetableEntry_classId_idx" ON "TimetableEntry"("classId");

-- CreateIndex
CREATE INDEX "CancelledDay_academyId_idx" ON "CancelledDay"("academyId");

-- CreateIndex
CREATE UNIQUE INDEX "CancelledDay_classId_date_key" ON "CancelledDay"("classId", "date");
