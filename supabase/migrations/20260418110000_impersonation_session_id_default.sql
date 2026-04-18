-- "ImpersonationSession"."id" had no DEFAULT; server inserts only set adminUserId + agencyId.
ALTER TABLE public."ImpersonationSession"
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
