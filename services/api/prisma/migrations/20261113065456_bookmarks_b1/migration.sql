-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverStorageKey" VARCHAR(512),
    "coverFileName" VARCHAR(256),
    "coverMimeType" VARCHAR(64),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_coverStorageKey_key" ON "bookmarks"("coverStorageKey");

-- CreateIndex
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
