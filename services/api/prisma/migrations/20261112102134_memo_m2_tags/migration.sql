-- AlterTable
ALTER TABLE "memos" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
