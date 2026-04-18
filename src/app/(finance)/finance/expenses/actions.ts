'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireFinanceUserContext } from '@/lib/financeAuth'

export async function approveExpense(expenseId: string) {
  const { userId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })

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
  const { userId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })

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
