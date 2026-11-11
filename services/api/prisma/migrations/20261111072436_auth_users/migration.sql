-- M0 用户与认证：users 表 + 用户隔离。
-- 既有数据全部划归默认用户 chpli（固定 uuid，passwordHash = null，密码登录禁用）。

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "passwordHash" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Bootstrap user owning all pre-existing data
INSERT INTO "users" ("id", "username", "passwordHash", "createdAt", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'chpli', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AlterTable: add userId columns nullable first, backfill, then enforce NOT NULL
ALTER TABLE "Trip" ADD COLUMN "userId" TEXT;
UPDATE "Trip" SET "userId" = '00000000-0000-4000-8000-000000000001' WHERE "userId" IS NULL;
ALTER TABLE "Trip" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "CalendarEvent" ADD COLUMN "userId" TEXT;
UPDATE "CalendarEvent" SET "userId" = '00000000-0000-4000-8000-000000000001' WHERE "userId" IS NULL;
ALTER TABLE "CalendarEvent" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "calendars" ADD COLUMN "userId" TEXT;
UPDATE "calendars" SET "userId" = '00000000-0000-4000-8000-000000000001' WHERE "userId" IS NULL;
ALTER TABLE "calendars" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");
CREATE INDEX "CalendarEvent_userId_idx" ON "CalendarEvent"("userId");
CREATE INDEX "calendars_userId_idx" ON "calendars"("userId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
