'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { ChaseMethod } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createChaseNote(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id?: string }).id
  if (!userId) {
    throw new Error('Missing user context')
  }

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyId: true },
  })

  if (!user?.agencyId) {
    throw new Error('No agency found for this user')
  }

  await prisma.chaseNote.create({
    data: {
      invoiceTripletId,
      agencyId: user.agencyId,
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
