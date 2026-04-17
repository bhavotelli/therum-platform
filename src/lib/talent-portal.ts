import prisma from "@/lib/prisma";

export type TalentPortalMilestone = {
  id: string;
  dealId: string;
  dealTitle: string;
  clientName: string;
  description: string;
  invoiceDate: Date;
  grossAmount: number;
  commissionAmount: number | null;
  netPayoutAmount: number | null;
  projectedCommissionAmount: number;
  projectedNetPayoutAmount: number;
  commissionRate: number;
  milestoneStatus: string;
  payoutStatus: string;
  invoicePaidAt: Date | null;
  payoutDate: Date | null;
  invoiceRef: string | null;
  commissionRef: string | null;
  deliverables: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    status: string;
  }>;
};

export type TalentPortalData = {
  talent: {
    id: string;
    name: string;
    email: string;
    commissionRate: number;
    vatRegistered: boolean;
    vatNumber: string | null;
    portalEnabled: boolean;
  };
  milestones: TalentPortalMilestone[];
  summary: {
    totalDeals: number;
    totalMilestones: number;
    paymentsReceived: number;
    payoutsReady: number;
    payoutsPaid: number;
    grossReceived: number;
    netPaidOut: number;
    netPending: number;
    projectedGrossToInvoice: number;
    projectedCommissionToInvoice: number;
    projectedNetToInvoice: number;
    lastSyncedAt: Date | null;
  };
};

export function formatCurrency(amount: number, currency: string = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
}

export async function resolveTalentIdForUser(userId: string | undefined) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { talentId: true },
  });
  return user?.talentId ?? null;
}

export async function getTalentPortalData(talentId: string): Promise<TalentPortalData | null> {
  const talent = await prisma.talent.findUnique({
    where: { id: talentId },
    select: {
      id: true,
      name: true,
      email: true,
      commissionRate: true,
      vatRegistered: true,
      vatNumber: true,
      portalEnabled: true,
      deals: {
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { name: true } },
          milestones: {
            orderBy: { invoiceDate: "desc" },
            include: {
              invoiceTriplet: true,
              deliverables: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!talent) return null;

  const milestones: TalentPortalMilestone[] = talent.deals.flatMap((deal) =>
    deal.milestones.map((milestone) => ({
      commissionRate: Number(deal.commissionRate),
      id: milestone.id,
      dealId: deal.id,
      dealTitle: deal.title,
      clientName: deal.client.name,
      description: milestone.description,
      invoiceDate: milestone.invoiceDate,
      grossAmount: Number(milestone.grossAmount),
      commissionAmount: milestone.invoiceTriplet ? Number(milestone.invoiceTriplet.commissionAmount) : null,
      netPayoutAmount: milestone.invoiceTriplet ? Number(milestone.invoiceTriplet.netPayoutAmount) : null,
      projectedCommissionAmount:
        milestone.invoiceTriplet
          ? Number(milestone.invoiceTriplet.commissionAmount)
          : Number(milestone.grossAmount) * (Number(deal.commissionRate) / 100),
      projectedNetPayoutAmount:
        milestone.invoiceTriplet
          ? Number(milestone.invoiceTriplet.netPayoutAmount)
          : Number(milestone.grossAmount) * (1 - Number(deal.commissionRate) / 100),
      milestoneStatus: milestone.status,
      payoutStatus: milestone.payoutStatus,
      invoicePaidAt: milestone.invoiceTriplet?.invPaidAt ?? null,
      payoutDate: milestone.payoutDate,
      invoiceRef:
        milestone.invoiceTriplet?.invNumber ??
        milestone.invoiceTriplet?.obiNumber ??
        null,
      commissionRef: milestone.invoiceTriplet?.comNumber ?? null,
      deliverables: milestone.deliverables.map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        dueDate: deliverable.dueDate,
        status: deliverable.status,
      })),
    })),
  );

  const uniqueDealIds = new Set(milestones.map((milestone) => milestone.dealId));
  const grossReceived = milestones
    .filter((milestone) => milestone.invoicePaidAt)
    .reduce((sum, milestone) => sum + milestone.grossAmount, 0);
  const netPaidOut = milestones
    .filter((milestone) => milestone.payoutStatus === "PAID")
    .reduce((sum, milestone) => sum + (milestone.netPayoutAmount ?? 0), 0);
  const netPending = milestones
    .filter((milestone) => milestone.invoicePaidAt && milestone.payoutStatus !== "PAID")
    .reduce((sum, milestone) => sum + (milestone.netPayoutAmount ?? 0), 0);
  const upcomingMilestones = milestones.filter(
    (milestone) =>
      milestone.milestoneStatus === "PENDING" || milestone.milestoneStatus === "COMPLETE",
  );
  const projectedGrossToInvoice = upcomingMilestones.reduce(
    (sum, milestone) => sum + milestone.grossAmount,
    0,
  );
  const projectedCommissionToInvoice = upcomingMilestones.reduce(
    (sum, milestone) => sum + milestone.projectedCommissionAmount,
    0,
  );
  const projectedNetToInvoice = upcomingMilestones.reduce(
    (sum, milestone) => sum + milestone.projectedNetPayoutAmount,
    0,
  );
  const lastSyncedAt = milestones.reduce<Date | null>((latest, milestone) => {
    const candidates = [
      milestone.invoicePaidAt,
      milestone.payoutDate,
      milestone.invoiceDate,
    ].filter((date): date is Date => !!date);
    if (candidates.length === 0) return latest;
    const maxCandidate = new Date(Math.max(...candidates.map((date) => date.getTime())));
    if (!latest || maxCandidate.getTime() > latest.getTime()) {
      return maxCandidate;
    }
    return latest;
  }, null);

  return {
    talent: {
      id: talent.id,
      name: talent.name,
      email: talent.email,
      commissionRate: Number(talent.commissionRate),
      vatRegistered: talent.vatRegistered,
      vatNumber: talent.vatNumber,
      portalEnabled: talent.portalEnabled,
    },
    milestones,
    summary: {
      totalDeals: uniqueDealIds.size,
      totalMilestones: milestones.length,
      paymentsReceived: milestones.filter((milestone) => !!milestone.invoicePaidAt).length,
      payoutsReady: milestones.filter((milestone) => milestone.payoutStatus === "READY").length,
      payoutsPaid: milestones.filter((milestone) => milestone.payoutStatus === "PAID").length,
      grossReceived,
      netPaidOut,
      netPending,
      projectedGrossToInvoice,
      projectedCommissionToInvoice,
      projectedNetToInvoice,
      lastSyncedAt,
    },
  };
}
