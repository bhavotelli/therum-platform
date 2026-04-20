CREATE TABLE "PayoutAdjustment" (
  "id"              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  "agencyId"        UUID        NOT NULL REFERENCES "Agency"("id") ON DELETE CASCADE,
  "talentId"        UUID        NOT NULL REFERENCES "Talent"("id") ON DELETE CASCADE,
  "currency"        TEXT        NOT NULL DEFAULT 'GBP',
  "type"            TEXT        NOT NULL,
  "amount"          DECIMAL(12, 2) NOT NULL,
  "description"     TEXT        NOT NULL,
  "appliedAt"       TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdByUserId" UUID        REFERENCES "User"("id") ON DELETE SET NULL
);

ALTER TABLE "PayoutAdjustment" ENABLE ROW LEVEL SECURITY;
