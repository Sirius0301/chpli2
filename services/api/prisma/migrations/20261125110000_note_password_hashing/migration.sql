-- N3 follow-up: access passwords are now stored as scrypt hashes. Values
-- written before this change were plaintext (dev/test data only) and are
-- cleared; users simply set the password again.
UPDATE "notes" SET "accessPassword" = NULL WHERE "accessPassword" IS NOT NULL;
