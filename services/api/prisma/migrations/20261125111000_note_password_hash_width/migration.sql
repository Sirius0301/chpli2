-- scrypt$<salt>$<hash> is 103 chars; the old 64-char column truncated it.
ALTER TABLE "notes" ALTER COLUMN "accessPassword" TYPE VARCHAR(160);
