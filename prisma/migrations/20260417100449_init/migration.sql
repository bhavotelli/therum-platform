-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('BETA', 'SMALL', 'MID', 'LARGE');

-- CreateEnum
CREATE TYPE "InvoicingModel" AS ENUM ('SELF_BILLING', 'ON_BEHALF');

-- CreateEnum
CREATE TYPE "ContactRole" AS ENUM ('PRIMARY', 'FINANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('PIPELINE', 'CONTRACTED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'COMPLETE', 'INVOICED', 'PAID', 'PAYOUT_READY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'READY', 'PAID');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChaseMethod" AS ENUM ('EMAIL', 'PHONE', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRAVEL', 'ACCOMMODATION', 'PRODUCTION', 'USAGE_RIGHTS', 'TALENT_FEE_UPLIFT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExpenseIncurredBy" AS ENUM ('AGENCY', 'TALENT');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'INVOICED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'AGENCY_ADMIN', 'AGENT', 'FINANCE', 'TALENT');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "agencyId" UUID,
    "talentId" UUID,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "inviteToken" TEXT,
    "inviteExpiry" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agency" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "planTier" "PlanTier" NOT NULL DEFAULT 'BETA',
    "xeroTenantId" TEXT,
    "xeroTokens" TEXT,
    "stripeAccountId" TEXT,
    "commissionDefault" DECIMAL(5,2) NOT NULL,
    "invoicingModel" "InvoicingModel" NOT NULL,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "xeroAccountCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "xeroContactId" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "ContactRole" NOT NULL DEFAULT 'OTHER',
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talent" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "xeroContactId" TEXT,
    "stripeAccountId" TEXT,
    "portalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Talent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "talentId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "DealStage" NOT NULL DEFAULT 'PIPELINE',
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "paymentTermsDays" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "contractRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "deliveryDueDate" DATE,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payoutDate" DATE,
    "cancelledByTripletId" UUID,
    "replacedCancelledMilestoneId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceTriplet" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "invoicingModel" "InvoicingModel" NOT NULL,
    "invNumber" TEXT,
    "sbiNumber" TEXT,
    "obiNumber" TEXT,
    "cnNumber" TEXT,
    "xeroObiId" TEXT,
    "xeroCnId" TEXT,
    "comNumber" TEXT NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "netPayoutAmount" DECIMAL(12,2) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invDueDateDays" INTEGER NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "xeroInvId" TEXT,
    "xeroSbiId" TEXT,
    "xeroComId" TEXT,
    "invPaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceTriplet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChaseNote" (
    "id" UUID NOT NULL,
    "invoiceTripletId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "contactedName" TEXT NOT NULL,
    "contactedEmail" TEXT NOT NULL,
    "method" "ChaseMethod" NOT NULL,
    "note" TEXT NOT NULL,
    "nextChaseDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualCreditNote" (
    "id" UUID NOT NULL,
    "invoiceTripletId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "cnNumber" TEXT NOT NULL,
    "cnDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "requiresReplacement" BOOLEAN NOT NULL DEFAULT false,
    "replacementMilestoneId" UUID,
    "xeroCnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualCreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealExpense" (
    "id" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "dealId" UUID NOT NULL,
    "milestoneId" UUID,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "vatApplicable" BOOLEAN NOT NULL DEFAULT true,
    "incurredBy" "ExpenseIncurredBy" NOT NULL,
    "rechargeable" BOOLEAN NOT NULL DEFAULT false,
    "contractSignOff" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "supplierRef" TEXT,
    "notes" TEXT,
    "invoiceLineRef" TEXT,
    "invoicedOnInvId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agencyId_idx" ON "User"("agencyId");

-- CreateIndex
CREATE INDEX "User_talentId_idx" ON "User"("talentId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ResetToken_token_key" ON "ResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE INDEX "Client_agencyId_idx" ON "Client"("agencyId");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "Talent_agencyId_idx" ON "Talent"("agencyId");

-- CreateIndex
CREATE INDEX "Deal_agencyId_idx" ON "Deal"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_replacedCancelledMilestoneId_key" ON "Milestone"("replacedCancelledMilestoneId");

-- CreateIndex
CREATE INDEX "Milestone_dealId_idx" ON "Milestone"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceTriplet_milestoneId_key" ON "InvoiceTriplet"("milestoneId");

-- CreateIndex
CREATE INDEX "ChaseNote_invoiceTripletId_idx" ON "ChaseNote"("invoiceTripletId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualCreditNote_invoiceTripletId_key" ON "ManualCreditNote"("invoiceTripletId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualCreditNote_replacementMilestoneId_key" ON "ManualCreditNote"("replacementMilestoneId");

-- CreateIndex
CREATE INDEX "ManualCreditNote_agencyId_idx" ON "ManualCreditNote"("agencyId");

-- CreateIndex
CREATE INDEX "DealExpense_dealId_idx" ON "DealExpense"("dealId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResetToken" ADD CONSTRAINT "ResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talent" ADD CONSTRAINT "Talent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_replacedCancelledMilestoneId_fkey" FOREIGN KEY ("replacedCancelledMilestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceTriplet" ADD CONSTRAINT "InvoiceTriplet_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaseNote" ADD CONSTRAINT "ChaseNote_invoiceTripletId_fkey" FOREIGN KEY ("invoiceTripletId") REFERENCES "InvoiceTriplet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaseNote" ADD CONSTRAINT "ChaseNote_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaseNote" ADD CONSTRAINT "ChaseNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualCreditNote" ADD CONSTRAINT "ManualCreditNote_invoiceTripletId_fkey" FOREIGN KEY ("invoiceTripletId") REFERENCES "InvoiceTriplet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualCreditNote" ADD CONSTRAINT "ManualCreditNote_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualCreditNote" ADD CONSTRAINT "ManualCreditNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualCreditNote" ADD CONSTRAINT "ManualCreditNote_replacementMilestoneId_fkey" FOREIGN KEY ("replacementMilestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealExpense" ADD CONSTRAINT "DealExpense_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealExpense" ADD CONSTRAINT "DealExpense_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealExpense" ADD CONSTRAINT "DealExpense_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealExpense" ADD CONSTRAINT "DealExpense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealExpense" ADD CONSTRAINT "DealExpense_invoicedOnInvId_fkey" FOREIGN KEY ("invoicedOnInvId") REFERENCES "InvoiceTriplet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
