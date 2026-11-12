-- CreateTable
CREATE TABLE "memo_images" (
    "id" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "fileName" VARCHAR(256) NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memo_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memo_images_storageKey_key" ON "memo_images"("storageKey");

-- CreateIndex
CREATE INDEX "memo_images_memoId_idx" ON "memo_images"("memoId");

-- AddForeignKey
ALTER TABLE "memo_images" ADD CONSTRAINT "memo_images_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
