-- CreateTable
CREATE TABLE "calendars" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" CHAR(7) NOT NULL,
    "type" TEXT NOT NULL,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "regionCode" VARCHAR(16),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "location" VARCHAR(256),
    "description" TEXT,
    "sourceModule" TEXT,
    "sourceRef" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "offsetDays" SMALLINT NOT NULL,
    "preset" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "triggerAt" TIMESTAMPTZ NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_entries" (
    "id" TEXT NOT NULL,
    "regionCode" VARCHAR(16) NOT NULL,
    "date" DATE NOT NULL,
    "nameZh" VARCHAR(64) NOT NULL,
    "nameEn" VARCHAR(64) NOT NULL,
    "nameDe" VARCHAR(64) NOT NULL,
    "isWorkday" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "holiday_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendars_type_regionCode_idx" ON "calendars"("type", "regionCode");

-- CreateIndex
CREATE INDEX "events_calendarId_startAt_idx" ON "events"("calendarId", "startAt");

-- CreateIndex
CREATE INDEX "reminders_status_triggerAt_idx" ON "reminders"("status", "triggerAt");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_entries_regionCode_date_key" ON "holiday_entries"("regionCode", "date");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
