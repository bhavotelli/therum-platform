import prisma from '@/lib/prisma'

export type PayoutQueueItem = {
  milestoneId: string
  milestoneDescription: string
  payoutStatus: string
  dealId: string
  dealTitle: string
  currency: string
  talentName: string
  talentEmail: string
  grossAmount: number
  commissionAmount: number
  netPayoutAmount: number
}

export type PayoutTalentSummary = {
  talentName: string
  talentEmail: string
  currency: string
  milestoneCount: number
  totalGross: number
  totalCommission: number
  totalNet: number
}

export async function getPayoutQueue(agencyId: string): Promise<PayoutQueueItem[]> {
  const milestones = await prisma.milestone.findMany({
    where: {
      payoutStatus: 'READY',
      deal: { agencyId },
    },
    include: {
      deal: {
        select: {
          id: true,
          title: true,
          currency: true,
          talent: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      invoiceTriplet: {
        select: {
          grossAmount: true,
          commissionAmount: true,
          netPayoutAmount: true,
        },
      },
    },
    orderBy: {
      invoiceDate: 'asc',
    },
  })

  return milestones.map((milestone) => {
    const grossAmount = Number(milestone.invoiceTriplet?.grossAmount ?? milestone.grossAmount)
    const commissionAmount = Number(milestone.invoiceTriplet?.commissionAmount ?? 0)
    const netPayoutAmount = Number(milestone.invoiceTriplet?.netPayoutAmount ?? grossAmount - commissionAmount)

    return {
      milestoneId: milestone.id,
      milestoneDescription: milestone.description,
      payoutStatus: milestone.payoutStatus,
      dealId: milestone.deal.id,
      dealTitle: milestone.deal.title,
      currency: milestone.deal.currency || 'GBP',
      talentName: milestone.deal.talent.name,
      talentEmail: milestone.deal.talent.email,
      grossAmount,
      commissionAmount,
      netPayoutAmount,
    }
  })
}

export function buildTalentSummary(items: PayoutQueueItem[]): PayoutTalentSummary[] {
  const map = new Map<string, PayoutTalentSummary>()

  for (const item of items) {
    const key = `${item.talentEmail}-${item.currency}`
    const current = map.get(key)
    if (!current) {
      map.set(key, {
        talentName: item.talentName,
        talentEmail: item.talentEmail,
        currency: item.currency,
        milestoneCount: 1,
        totalGross: item.grossAmount,
        totalCommission: item.commissionAmount,
        totalNet: item.netPayoutAmount,
      })
      continue
    }

    current.milestoneCount += 1
    current.totalGross += item.grossAmount
    current.totalCommission += item.commissionAmount
    current.totalNet += item.netPayoutAmount
  }

  return [...map.values()].sort((a, b) => a.talentName.localeCompare(b.talentName))
}
