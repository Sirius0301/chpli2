-- N3 cnblog-style publish form fields on notes.

-- AlterTable
ALTER TABLE "notes" ADD COLUMN     "accessPassword" VARCHAR(64),
ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "category" VARCHAR(32),
ADD COLUMN     "excerpt" VARCHAR(500),
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishAt" TIMESTAMP(3),
ADD COLUMN     "publishStatus" VARCHAR(12) NOT NULL DEFAULT 'draft',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "showOnHome" BOOLEAN NOT NULL DEFAULT false;
