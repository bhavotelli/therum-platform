'use server'

import { revalidatePath } from 'next/cache'

import { requireFinanceUserContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function approveExpense(expenseId: string) {
  const { userId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })

  const db = getSupabaseServiceRole()
  const { error } = await db
    .from('DealExpense')
    .update({
      status: 'APPROVED',
      approvedById: userId,
      approvedAt: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .eq('agencyId', agencyId)
    .eq('status', 'PENDING')
  if (error) throw error

  revalidatePath('/finance/expenses')
}

export async function rejectExpense(expenseId: string) {
  const { userId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })

  const db = getSupabaseServiceRole()
  const { error } = await db
    .from('DealExpense')
    .update({
      status: 'EXCLUDED',
      approvedById: userId,
      approvedAt: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .eq('agencyId', agencyId)
    .eq('status', 'PENDING')
  if (error) throw error

  revalidatePath('/finance/expenses')
}
