-- Growth G2: unified growth_links (goal|skill|review x notes|bookmarks|memos),
-- skills and reviews tables. Existing goal_links rows are preserved.

-- CreateTable
CREATE TABLE "growth_links" (
    "id" TEXT NOT NULL,
    "ownerType" VARCHAR(8) NOT NULL,
    "ownerId" VARCHAR(36) NOT NULL,
    "module" VARCHAR(16) NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "goalId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "content" TEXT,
    "reviewedAt" DATE NOT NULL,
    "goalId" TEXT,
    "nextMemoId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_links_ownerType_ownerId_module_refId_key" ON "growth_links"("ownerType", "ownerId", "module", "refId");

-- CreateIndex
CREATE INDEX "growth_links_ownerType_ownerId_idx" ON "growth_links"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_userId_name_key" ON "skills"("userId", "name");

-- CreateIndex
CREATE INDEX "skills_userId_idx" ON "skills"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_nextMemoId_key" ON "reviews"("nextMemoId");

-- CreateIndex
CREATE INDEX "reviews_userId_reviewedAt_idx" ON "reviews"("userId", "reviewedAt");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration (G2 D3): preserve existing goal links in the unified table.
INSERT INTO "growth_links" ("id", "ownerType", "ownerId", "module", "refId", "createdAt")
SELECT "id", 'goal', "goalId", "module", "refId", "createdAt" FROM "goal_links";

-- DropTable (rows copied above)
DROP TABLE "goal_links";
