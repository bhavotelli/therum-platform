-- Align with app inserts: "ResetToken"."id" and "createdAt" must not be NULL without defaults.
ALTER TABLE public."ResetToken"
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public."ResetToken"
  ALTER COLUMN "createdAt" SET DEFAULT now();
