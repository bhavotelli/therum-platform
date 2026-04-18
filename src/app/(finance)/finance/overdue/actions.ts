'use server'

import prisma from '@/lib/prisma'
import { ChaseMethod } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireFinanceUserContext } from '@/lib/financeAuth'

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

  const method = Object.values(ChaseMethod).includes(methodInput as ChaseMethod)
    ? (methodInput as ChaseMethod)
    : ChaseMethod.OTHER

  const triplet = await prisma.invoiceTriplet.findFirst({
    where: {
      id: invoiceTripletId,
      milestone: { deal: { agencyId } },
    },
    select: { id: true },
  })

  if (!triplet) {
    throw new Error('Invoice not found in your agency')
  }

  await prisma.chaseNote.create({
    data: {
      invoiceTripletId,
      agencyId,
      createdByUserId: userId,
      contactedName,
      contactedEmail,
      method,
      note,
      nextChaseDate: nextChaseDateRaw ? new Date(nextChaseDateRaw) : null,
    },
  })

  revalidatePath('/finance/overdue')
}
