-- RLS policies for tenant isolation when using the Supabase anon key + user JWT.
-- The service role bypasses RLS (Next.js admin + most server paths today).
-- Helpers use SECURITY DEFINER and auth.uid() linked via public."User"."authUserId"
-- (see src/lib/auth/resolve-app-user.ts).

-- ─── Helper functions ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u."agencyId"
  FROM public."User" u
  WHERE u."authUserId" = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public."User" u
  WHERE u."authUserId" = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_talent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u."talentId"
  FROM public."User" u
  WHERE u."authUserId" = auth.uid()
    AND u.role = 'TALENT'
  LIMIT 1;
$$;

-- Agency staff + finance (excludes TALENT and SUPER_ADMIN for tenant data paths).
CREATE OR REPLACE FUNCTION public.is_agency_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."User" u
    WHERE u."authUserId" = auth.uid()
      AND u.role IN ('AGENCY_ADMIN', 'AGENT', 'FINANCE')
  );
$$;

CREATE OR REPLACE FUNCTION public.deal_visible_to_session(did uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."Deal" d
    WHERE d.id = did
      AND (
        (
          d."agencyId" = public.get_current_agency_id()
          AND public.is_agency_staff()
        )
        OR (
          d."talentId" = public.get_current_talent_id()
          AND public.get_current_talent_id() IS NOT NULL
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_current_agency_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_talent_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_agency_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deal_visible_to_session(uuid) TO authenticated;

-- ─── Agency ─────────────────────────────────────────────────────────────────

CREATE POLICY "agency_tenant_select"
  ON public."Agency"
  FOR SELECT
  USING (id = public.get_current_agency_id());

CREATE POLICY "agency_tenant_update"
  ON public."Agency"
  FOR UPDATE
  USING (id = public.get_current_agency_id())
  WITH CHECK (id = public.get_current_agency_id());

-- ─── User ───────────────────────────────────────────────────────────────────

CREATE POLICY "user_select_tenant"
  ON public."User"
  FOR SELECT
  USING (
    "authUserId" = auth.uid()
    OR (
      "agencyId" IS NOT NULL
      AND "agencyId" = public.get_current_agency_id()
    )
  );

CREATE POLICY "user_update_self"
  ON public."User"
  FOR UPDATE
  USING ("authUserId" = auth.uid())
  WITH CHECK ("authUserId" = auth.uid());

-- ─── Client & ClientContact ─────────────────────────────────────────────────
-- SELECT: anyone in the agency (including TALENT). Writes: agency staff only.

CREATE POLICY "client_select"
  ON public."Client"
  FOR SELECT
  USING ("agencyId" = public.get_current_agency_id());

CREATE POLICY "client_staff_insert"
  ON public."Client"
  FOR INSERT
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "client_staff_update"
  ON public."Client"
  FOR UPDATE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "client_staff_delete"
  ON public."Client"
  FOR DELETE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "client_contact_select"
  ON public."ClientContact"
  FOR SELECT
  USING ("agencyId" = public.get_current_agency_id());

CREATE POLICY "client_contact_staff_insert"
  ON public."ClientContact"
  FOR INSERT
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "client_contact_staff_update"
  ON public."ClientContact"
  FOR UPDATE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "client_contact_staff_delete"
  ON public."ClientContact"
  FOR DELETE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

-- ─── Talent ──────────────────────────────────────────────────────────────────

CREATE POLICY "talent_select"
  ON public."Talent"
  FOR SELECT
  USING (
    (
      public.is_agency_staff()
      AND "agencyId" = public.get_current_agency_id()
    )
    OR (id = public.get_current_talent_id())
  );

CREATE POLICY "talent_staff_write"
  ON public."Talent"
  FOR INSERT
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "talent_staff_update"
  ON public."Talent"
  FOR UPDATE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "talent_staff_delete"
  ON public."Talent"
  FOR DELETE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "talent_update_own_row"
  ON public."Talent"
  FOR UPDATE
  USING (id = public.get_current_talent_id())
  WITH CHECK (id = public.get_current_talent_id());

-- ─── Deal ────────────────────────────────────────────────────────────────────

CREATE POLICY "deal_select"
  ON public."Deal"
  FOR SELECT
  USING (public.deal_visible_to_session(id));

CREATE POLICY "deal_staff_write"
  ON public."Deal"
  FOR INSERT
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "deal_staff_update"
  ON public."Deal"
  FOR UPDATE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "deal_staff_delete"
  ON public."Deal"
  FOR DELETE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

-- ─── Milestone ───────────────────────────────────────────────────────────────

CREATE POLICY "milestone_select"
  ON public."Milestone"
  FOR SELECT
  USING (public.deal_visible_to_session("dealId"));

CREATE POLICY "milestone_staff_write"
  ON public."Milestone"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public."Deal" d
      WHERE d.id = "Milestone"."dealId"
        AND d."agencyId" = public.get_current_agency_id()
        AND public.is_agency_staff()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Deal" d
      WHERE d.id = "Milestone"."dealId"
        AND d."agencyId" = public.get_current_agency_id()
        AND public.is_agency_staff()
    )
  );

-- ─── Deliverable ─────────────────────────────────────────────────────────────

CREATE POLICY "deliverable_select"
  ON public."Deliverable"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public."Milestone" m
      WHERE m.id = "Deliverable"."milestoneId"
        AND public.deal_visible_to_session(m."dealId")
    )
  );

CREATE POLICY "deliverable_staff_write"
  ON public."Deliverable"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public."Milestone" m
      JOIN public."Deal" d ON d.id = m."dealId"
      WHERE m.id = "Deliverable"."milestoneId"
        AND d."agencyId" = public.get_current_agency_id()
        AND public.is_agency_staff()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Milestone" m
      JOIN public."Deal" d ON d.id = m."dealId"
      WHERE m.id = "Deliverable"."milestoneId"
        AND d."agencyId" = public.get_current_agency_id()
        AND public.is_agency_staff()
    )
  );

-- ─── InvoiceTriplet ──────────────────────────────────────────────────────────

CREATE POLICY "invoice_triplet_select"
  ON public."InvoiceTriplet"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public."Milestone" m
      WHERE m.id = "InvoiceTriplet"."milestoneId"
        AND public.deal_visible_to_session(m."dealId")
    )
  );

CREATE POLICY "invoice_triplet_staff_write"
  ON public."InvoiceTriplet"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public."Milestone" m
      JOIN public."Deal" d ON d.id = m."dealId"
      WHERE m.id = "InvoiceTriplet"."milestoneId"
        AND d."agencyId" = public.get_current_agency_id()
        AND public.is_agency_staff()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Milestone" m
      JOIN public."Deal" d ON d.id = m."dealId"
      WHERE m.id = "InvoiceTriplet"."milestoneId"
        AND d."agencyId" = public.get_current_agency_id()
        AND public.is_agency_staff()
    )
  );

-- Finance users: same agency; include FINANCE in is_agency_staff — already included.
-- Finance-specific invoice approval: still uses staff write above (FINANCE in is_agency_staff).

-- ─── ManualCreditNote, ChaseNote, DealExpense ────────────────────────────────

CREATE POLICY "manual_credit_note_staff_all"
  ON public."ManualCreditNote"
  FOR ALL
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "chase_note_staff_all"
  ON public."ChaseNote"
  FOR ALL
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "deal_expense_select"
  ON public."DealExpense"
  FOR SELECT
  USING (
    (
      public.is_agency_staff()
      AND "agencyId" = public.get_current_agency_id()
    )
    OR public.deal_visible_to_session("dealId")
  );

CREATE POLICY "deal_expense_staff_write"
  ON public."DealExpense"
  FOR INSERT
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "deal_expense_staff_update"
  ON public."DealExpense"
  FOR UPDATE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  )
  WITH CHECK (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

CREATE POLICY "deal_expense_staff_delete"
  ON public."DealExpense"
  FOR DELETE
  USING (
    public.is_agency_staff()
    AND "agencyId" = public.get_current_agency_id()
  );

-- ─── Session & ResetToken (app user id, not auth.uid) ──────────────────────────

CREATE POLICY "session_own_user"
  ON public."Session"
  FOR ALL
  USING ("userId" = public.get_current_app_user_id())
  WITH CHECK ("userId" = public.get_current_app_user_id());

CREATE POLICY "reset_token_own_user"
  ON public."ResetToken"
  FOR ALL
  USING ("userId" = public.get_current_app_user_id())
  WITH CHECK ("userId" = public.get_current_app_user_id());

-- ─── Admin-only tables (JWT cannot access; service role bypasses RLS) ────────

CREATE POLICY "admin_audit_log_deny_authenticated"
  ON public."AdminAuditLog"
  FOR ALL
  USING (false);

CREATE POLICY "preview_log_deny_authenticated"
  ON public."PreviewLog"
  FOR ALL
  USING (false);

CREATE POLICY "impersonation_session_deny_authenticated"
  ON public."ImpersonationSession"
  FOR ALL
  USING (false);
