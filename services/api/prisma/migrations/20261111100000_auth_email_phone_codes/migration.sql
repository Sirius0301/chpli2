-- M0 增强：users 增加 email/phone（可空唯一），新增 login_codes 验证码表。

ALTER TABLE "users" ADD COLUMN "email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(32);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

CREATE TABLE "login_codes" (
    "id" TEXT NOT NULL,
    "channel" VARCHAR(8) NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "login_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "login_codes_destination_idx" ON "login_codes"("destination");
