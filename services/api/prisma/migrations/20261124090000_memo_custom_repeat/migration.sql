-- Custom repeat rule: freely chosen weekdays (0=Sun…6=Sat) per memo.
ALTER TABLE "memos" ADD COLUMN "repeatDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- Fold the legacy presets that overlap the custom rule into it so existing
-- data keeps its exact occurrence dates:
--   weekly   -> custom on the weekday of the memo date
--   weekdays -> custom on Monday..Friday
UPDATE "memos"
SET "repeatDays" = ARRAY[(EXTRACT(ISODOW FROM "date")::int % 7)],
    "repeat" = 'custom'
WHERE "repeat" = 'weekly';

UPDATE "memos"
SET "repeatDays" = ARRAY[1, 2, 3, 4, 5],
    "repeat" = 'custom'
WHERE "repeat" = 'weekdays';

-- biweekly has no custom equivalent and stays a supported stored value.
