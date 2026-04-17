-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED');

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" UUID NOT NULL,
    "milestoneId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATE,
    "status" "DeliverableStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deliverable_milestoneId_idx" ON "Deliverable"("milestoneId");

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
