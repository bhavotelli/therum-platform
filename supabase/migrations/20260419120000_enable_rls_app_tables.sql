-- Defense-in-depth: enable RLS on application tables so anon/authenticated PostgREST
-- cannot read/write tenant data if keys are misused. The Next.js server uses the
-- Supabase service role, which bypasses RLS; login flows use only auth.* via the anon key.

ALTER TABLE public."Agency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImpersonationSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PreviewLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ClientContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Talent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Deal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Milestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Deliverable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceTriplet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChaseNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ManualCreditNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DealExpense" ENABLE ROW LEVEL SECURITY;
