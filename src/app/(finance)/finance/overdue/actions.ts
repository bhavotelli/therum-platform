'use server'

import { revalidatePath } from 'next/cache'

import { requireFinanceUserContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { ChaseMethods, type ChaseMethod } from '@/types/database'

export async function createChaseNote(formData: FormData) {
  const { userId, agencyId } = await requireFinanceUserContext({ requireWriteAccess: true })

  const invoiceTripletId = String(formData.get('invoiceTripletId') || '')
  const contactedName = String(formData.get('contactedName') || '').trim()
  const contactedEmail = String(formData.get('contactedEmail') || '').trim()
  const methodInput = String(formData.get('method') || '').trim().toUpperCase()
  const note = String(formData.get('note') || '').trim()
  const nextChaseDateRaw = String(formData.get('nextChaseDate') || '').trim()

  if (!invoiceTripletId || !contactedName || !contactedEmail || !note) {
    throw new Error('Missing required chase note fields')
  }

  const allowed = Object.values(ChaseMethods) as ChaseMethod[]
  const method: ChaseMethod = allowed.includes(methodInput as ChaseMethod)
    ? (methodInput as ChaseMethod)
    : ChaseMethods.OTHER

  const db = getSupabaseServiceRole()
  const { data: trip } = await db.from('InvoiceTriplet').select('id, milestoneId').eq('id', invoiceTripletId).maybeSingle()
  if (!trip) {
    throw new Error('Invoice not found in your agency')
  }
  const { data: ms } = await db.from('Milestone').select('dealId').eq('id', trip.milestoneId).maybeSingle()
  if (!ms) {
    throw new Error('Invoice not found in your agency')
  }
  const { data: dealRow } = await db.from('Deal').select('agencyId').eq('id', ms.dealId).maybeSingle()
  if (!dealRow || dealRow.agencyId !== agencyId) {
    throw new Error('Invoice not found in your agency')
  }

  const { error } = await db.from('ChaseNote').insert({
    invoiceTripletId,
    agencyId,
    createdByUserId: userId,
    contactedName,
    contactedEmail,
    method,
    note,
    nextChaseDate: nextChaseDateRaw ? nextChaseDateRaw.slice(0, 10) : null,
  })
  if (error) throw error

  revalidatePath('/finance/overdue')
}
