'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function getFinanceUserContext() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id?: string }).id
  if (!userId) {
    throw new Error('Missing user context')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, agencyId: true, role: true },
  })

  if (!user?.agencyId) {
    throw new Error('No agency found for this user')
  }

  return { userId: user.id, agencyId: user.agencyId }
}

export async function approveExpense(expenseId: string) {
  const { userId, agencyId } = await getFinanceUserContext()

  await prisma.dealExpense.updateMany({
    where: {
      id: expenseId,
      agencyId,
      status: 'PENDING',
    },
    data: {
      status: 'APPROVED',
      approvedById: userId,
      approvedAt: new Date(),
    },
  })

  revalidatePath('/finance/expenses')
}

export async function rejectExpense(expenseId: string) {
  const { userId, agencyId } = await getFinanceUserContext()

  await prisma.dealExpense.updateMany({
    where: {
      id: expenseId,
      agencyId,
      status: 'PENDING',
    },
    data: {
      status: 'EXCLUDED',
      approvedById: userId,
      approvedAt: new Date(),
    },
  })

  revalidatePath('/finance/expenses')
}
