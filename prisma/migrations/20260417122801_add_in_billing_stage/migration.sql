-- AlterEnum
ALTER TYPE "DealStage" ADD VALUE 'IN_BILLING';

-- CreateTable
CREATE TABLE "PreviewLog" (
    "id" UUID NOT NULL,
    "previewedBy" UUID NOT NULL,
    "talentId" UUID NOT NULL,
    "agencyId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewLog_startedAt_idx" ON "PreviewLog"("startedAt");

-- CreateIndex
CREATE INDEX "PreviewLog_previewedBy_startedAt_idx" ON "PreviewLog"("previewedBy", "startedAt");

-- CreateIndex
CREATE INDEX "PreviewLog_agencyId_startedAt_idx" ON "PreviewLog"("agencyId", "startedAt");

-- CreateIndex
CREATE INDEX "PreviewLog_talentId_startedAt_idx" ON "PreviewLog"("talentId", "startedAt");

-- AddForeignKey
ALTER TABLE "PreviewLog" ADD CONSTRAINT "PreviewLog_previewedBy_fkey" FOREIGN KEY ("previewedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewLog" ADD CONSTRAINT "PreviewLog_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "Talent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewLog" ADD CONSTRAINT "PreviewLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
