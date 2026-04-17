'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

async function resolveAgencyForSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id?: string }).id
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { agencyId: true },
      })
    : null

  const agencyId =
    user?.agencyId ??
    (
      await prisma.agency.findFirst({
        select: { id: true },
      })
    )?.id

  if (!agencyId) {
    throw new Error('No agency found for payout action')
  }

  return agencyId
}

export async function confirmPayoutRun(formData: FormData) {
  const agencyId = await resolveAgencyForSession()
  const rawIds = String(formData.get('milestoneIds') ?? '')
  const ids = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  let targetIds = ids
  if (targetIds.length === 0) {
    const allReady = await prisma.milestone.findMany({
      where: {
        deal: { agencyId },
        payoutStatus: 'READY',
      },
      select: { id: true },
    })
    targetIds = allReady.map((row) => row.id)
  }

  if (targetIds.length === 0) return

  const impactedMilestones = await prisma.milestone.findMany({
    where: {
      id: { in: targetIds },
      deal: { agencyId },
    },
    select: { dealId: true },
  })
  const impactedDealIds = [...new Set(impactedMilestones.map((row) => row.dealId))]

  const today = new Date()
  await prisma.milestone.updateMany({
    where: {
      id: { in: targetIds },
      deal: { agencyId },
      payoutStatus: 'READY',
    },
    data: {
      payoutStatus: 'PAID',
      payoutDate: today,
      status: 'PAID',
    },
  })

  if (impactedDealIds.length > 0) {
    const dealMilestones = await prisma.milestone.findMany({
      where: {
        dealId: { in: impactedDealIds },
      },
      select: {
        dealId: true,
        payoutStatus: true,
      },
    })

    const completionByDeal = new Map<string, boolean>()
    for (const dealId of impactedDealIds) {
      const milestones = dealMilestones.filter((row) => row.dealId === dealId)
      const allPaid = milestones.length > 0 && milestones.every((row) => row.payoutStatus === 'PAID')
      completionByDeal.set(dealId, allPaid)
    }

    const completedDealIds = impactedDealIds.filter((id) => completionByDeal.get(id))
    const inBillingDealIds = impactedDealIds.filter((id) => !completionByDeal.get(id))

    if (completedDealIds.length > 0) {
      await prisma.deal.updateMany({
        where: { id: { in: completedDealIds }, agencyId },
        data: { stage: 'COMPLETED', probability: 100 },
      })
    }
    if (inBillingDealIds.length > 0) {
      await prisma.deal.updateMany({
        where: { id: { in: inBillingDealIds }, agencyId },
        data: { stage: 'IN_BILLING', probability: 100 },
      })
    }
  }

  revalidatePath('/finance/payouts')
  revalidatePath('/finance/dashboard')
  revalidatePath('/finance/deals')
  revalidatePath('/agency/pipeline')
}
