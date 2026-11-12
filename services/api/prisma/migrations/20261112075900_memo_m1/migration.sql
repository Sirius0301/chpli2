-- DropIndex
DROP INDEX "CalendarEvent_userId_idx";

-- CreateTable
CREATE TABLE "memos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "date" DATE NOT NULL,
    "priority" VARCHAR(8) NOT NULL DEFAULT 'none',
    "note" TEXT,
    "repeat" VARCHAR(16) NOT NULL DEFAULT 'none',
    "repeatEnd" DATE,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memo_completions" (
    "id" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memo_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memos_userId_date_idx" ON "memos"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "memo_completions_memoId_date_key" ON "memo_completions"("memoId", "date");

-- AddForeignKey
ALTER TABLE "memos" ADD CONSTRAINT "memos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memo_completions" ADD CONSTRAINT "memo_completions_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
