-- Per-instance deletion for repeating memos: excluded occurrence dates are
-- skipped by repeat expansion on both client and server.
ALTER TABLE "memos" ADD COLUMN "excludedDates" DATE[] NOT NULL DEFAULT ARRAY[]::DATE[];
