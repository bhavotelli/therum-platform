/**
 * Supabase Postgres typings (public schema). Column names match Prisma / PostgreSQL.
 * Dates and decimals arrive as strings from PostgREST JSON.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type PlanTier = 'BETA' | 'SMALL' | 'MID' | 'LARGE'
export type InvoicingModel = 'SELF_BILLING' | 'ON_BEHALF'

export const InvoicingModels = {
  SELF_BILLING: 'SELF_BILLING',
  ON_BEHALF: 'ON_BEHALF',
} as const satisfies Record<string, InvoicingModel>
export type ContactRole = 'PRIMARY' | 'FINANCE' | 'OTHER'

export const ContactRoles = {
  PRIMARY: 'PRIMARY',
  FINANCE: 'FINANCE',
  OTHER: 'OTHER',
} as const satisfies Record<string, ContactRole>
export type DealStage = 'PIPELINE' | 'NEGOTIATING' | 'CONTRACTED' | 'ACTIVE' | 'IN_BILLING' | 'COMPLETED'

export const DealStages = {
  PIPELINE: 'PIPELINE',
  NEGOTIATING: 'NEGOTIATING',
  CONTRACTED: 'CONTRACTED',
  ACTIVE: 'ACTIVE',
  IN_BILLING: 'IN_BILLING',
  COMPLETED: 'COMPLETED',
} as const satisfies Record<string, DealStage>
export type MilestoneStatus =
  | 'PENDING'
  | 'COMPLETE'
  | 'INVOICED'
  | 'PAID'
  | 'PAYOUT_READY'
  | 'CANCELLED'
export type DeliverableStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED'
export type PayoutStatus = 'PENDING' | 'READY' | 'PAID'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ChaseMethod = 'EMAIL' | 'PHONE' | 'IN_PERSON' | 'OTHER'

export const ChaseMethods = {
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  IN_PERSON: 'IN_PERSON',
  OTHER: 'OTHER',
} as const satisfies Record<string, ChaseMethod>
export type ExpenseCategory =
  | 'TRAVEL'
  | 'ACCOMMODATION'
  | 'PRODUCTION'
  | 'USAGE_RIGHTS'
  | 'TALENT_FEE_UPLIFT'
  | 'OTHER'
export type ExpenseIncurredBy = 'AGENCY' | 'TALENT'
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'INVOICED' | 'EXCLUDED'
export type UserRole = 'SUPER_ADMIN' | 'AGENCY_ADMIN' | 'AGENT' | 'FINANCE' | 'TALENT'

/** Runtime enum-like map (replaces `@prisma/client` UserRole). */
export const UserRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  AGENCY_ADMIN: 'AGENCY_ADMIN',
  AGENT: 'AGENT',
  FINANCE: 'FINANCE',
  TALENT: 'TALENT',
} as const satisfies Record<string, UserRole>

export type UserRow = {
  id: string
  authUserId: string | null
  agencyId: string | null
  talentId: string | null
  role: UserRole
  active: boolean
  email: string
  passwordHash: string | null
  name: string
  inviteToken: string | null
  inviteExpiry: string | null
  lastLoginAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type AdminAuditLogRow = {
  id: string
  actorUserId: string | null
  action: string
  targetType: string
  targetId: string | null
  metadata: Json | null
  createdAt: string
}

export type ImpersonationSessionRow = {
  id: string
  adminUserId: string
  agencyId: string
  startedAt: string
  endedAt: string | null
  endedByUserId: string | null
}

export type PreviewLogRow = {
  id: string
  previewedBy: string
  talentId: string
  agencyId: string
  startedAt: string
}

export type SessionRow = {
  id: string
  userId: string
  token: string
  expiresAt: string
  createdAt: string
}

export type ResetTokenRow = {
  id: string
  userId: string
  token: string
  expiresAt: string
  createdAt: string
}

export type AgencyRow = {
  id: string
  name: string
  slug: string
  active: boolean
  planTier: PlanTier
  xeroTenantId: string | null
  xeroTokens: string | null
  stripeAccountId: string | null
  commissionDefault: string
  invoicingModel: InvoicingModel
  vatRegistered: boolean
  vatNumber: string | null
  xeroAccountCodes: Json | null
  dealNumberPrefix: string | null
  createdAt: string
  updatedAt: string
}

export type ClientRow = {
  id: string
  agencyId: string
  name: string
  paymentTermsDays: number
  xeroContactId: string | null
  vatNumber: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type ClientContactRow = {
  id: string
  clientId: string
  agencyId: string
  name: string
  email: string
  role: ContactRole
  phone: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type TalentRow = {
  id: string
  agencyId: string
  name: string
  email: string
  commissionRate: string
  vatRegistered: boolean
  vatNumber: string | null
  businessType: 'SELF_EMPLOYED' | 'LTD_COMPANY'
  companyName: string | null
  companyRegNumber: string | null
  registeredAddress: string | null
  xeroContactId: string | null
  stripeAccountId: string | null
  portalEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type DealRow = {
  id: string
  agencyId: string
  clientId: string
  talentId: string
  title: string
  stage: DealStage
  probability: number
  commissionRate: string
  paymentTermsDays: number | null
  currency: string
  dealNumber: string | null
  contractRef: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type MilestoneRow = {
  id: string
  dealId: string
  description: string
  grossAmount: string
  invoiceDate: string
  deliveryDueDate: string | null
  status: MilestoneStatus
  completedAt: string | null
  payoutStatus: PayoutStatus
  payoutDate: string | null
  cancelledByTripletId: string | null
  replacedCancelledMilestoneId: string | null
  createdAt: string
  updatedAt: string
}

export type DeliverableRow = {
  id: string
  milestoneId: string
  title: string
  dueDate: string | null
  status: DeliverableStatus
  createdAt: string
  updatedAt: string
}

export type InvoiceTripletRow = {
  id: string
  milestoneId: string
  invoicingModel: InvoicingModel
  invNumber: string | null
  sbiNumber: string | null
  obiNumber: string | null
  cnNumber: string | null
  xeroObiId: string | null
  xeroCnId: string | null
  comNumber: string | null
  grossAmount: string
  commissionRate: string
  commissionAmount: string
  netPayoutAmount: string
  invoiceDate: string
  issuedAt: string
  invDueDateDays: number
  approvalStatus: ApprovalStatus
  recipientContactName: string | null
  recipientContactEmail: string | null
  recipientContactRole: ContactRole | null
  poNumber: string | null
  invoiceNarrative: string | null
  invoiceAddress: string | null
  xeroInvId: string | null
  xeroSbiId: string | null
  xeroComId: string | null
  invPaidAt: string | null
  createdAt: string
  updatedAt: string
}

export type ChaseNoteRow = {
  id: string
  invoiceTripletId: string
  agencyId: string
  createdByUserId: string
  contactedName: string
  contactedEmail: string
  method: ChaseMethod
  note: string
  nextChaseDate: string | null
  createdAt: string
}

export type ManualCreditNoteRow = {
  id: string
  invoiceTripletId: string
  agencyId: string
  createdByUserId: string
  cnNumber: string
  cnDate: string
  amount: string
  reason: string
  requiresReplacement: boolean
  replacementMilestoneId: string | null
  xeroCnId: string | null
  createdAt: string
}

export type DealExpenseRow = {
  id: string
  agencyId: string
  dealId: string
  milestoneId: string | null
  description: string
  category: ExpenseCategory
  amount: string
  currency: string
  vatApplicable: boolean
  incurredBy: ExpenseIncurredBy
  rechargeable: boolean
  contractSignOff: boolean
  status: ExpenseStatus
  approvedById: string | null
  approvedAt: string | null
  receiptUrl: string | null
  supplierRef: string | null
  notes: string | null
  invoiceLineRef: string | null
  invoicedOnInvId: string | null
  createdAt: string
  updatedAt: string
}

type LooseInsert<Row> = Partial<Row>
type LooseUpdate<Row> = Partial<Row>

export interface Database {
  public: {
    Tables: {
      User: { Row: UserRow; Insert: LooseInsert<UserRow>; Update: LooseUpdate<UserRow> }
      AdminAuditLog: { Row: AdminAuditLogRow; Insert: LooseInsert<AdminAuditLogRow>; Update: LooseUpdate<AdminAuditLogRow> }
      ImpersonationSession: {
        Row: ImpersonationSessionRow
        Insert: LooseInsert<ImpersonationSessionRow>
        Update: LooseUpdate<ImpersonationSessionRow>
      }
      PreviewLog: { Row: PreviewLogRow; Insert: LooseInsert<PreviewLogRow>; Update: LooseUpdate<PreviewLogRow> }
      Session: { Row: SessionRow; Insert: LooseInsert<SessionRow>; Update: LooseUpdate<SessionRow> }
      ResetToken: { Row: ResetTokenRow; Insert: LooseInsert<ResetTokenRow>; Update: LooseUpdate<ResetTokenRow> }
      Agency: { Row: AgencyRow; Insert: LooseInsert<AgencyRow>; Update: LooseUpdate<AgencyRow> }
      Client: { Row: ClientRow; Insert: LooseInsert<ClientRow>; Update: LooseUpdate<ClientRow> }
      ClientContact: {
        Row: ClientContactRow
        Insert: LooseInsert<ClientContactRow>
        Update: LooseUpdate<ClientContactRow>
      }
      Talent: { Row: TalentRow; Insert: LooseInsert<TalentRow>; Update: LooseUpdate<TalentRow> }
      Deal: { Row: DealRow; Insert: LooseInsert<DealRow>; Update: LooseUpdate<DealRow> }
      Milestone: { Row: MilestoneRow; Insert: LooseInsert<MilestoneRow>; Update: LooseUpdate<MilestoneRow> }
      Deliverable: { Row: DeliverableRow; Insert: LooseInsert<DeliverableRow>; Update: LooseUpdate<DeliverableRow> }
      InvoiceTriplet: {
        Row: InvoiceTripletRow
        Insert: LooseInsert<InvoiceTripletRow>
        Update: LooseUpdate<InvoiceTripletRow>
      }
      ChaseNote: { Row: ChaseNoteRow; Insert: LooseInsert<ChaseNoteRow>; Update: LooseUpdate<ChaseNoteRow> }
      ManualCreditNote: {
        Row: ManualCreditNoteRow
        Insert: LooseInsert<ManualCreditNoteRow>
        Update: LooseUpdate<ManualCreditNoteRow>
      }
      DealExpense: { Row: DealExpenseRow; Insert: LooseInsert<DealExpenseRow>; Update: LooseUpdate<DealExpenseRow> }
    }
    Views: Record<string, never>
    Functions: Record<
      string,
      { Args: Record<string, unknown>; Returns: Json | null | number | boolean | string | undefined }
    >
    Enums: Record<string, never>
  }
}
