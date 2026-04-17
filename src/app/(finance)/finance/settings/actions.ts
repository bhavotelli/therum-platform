'use server'

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function disconnectXero() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as any).id as string

  // Resolve the agency via the authenticated user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyId: true },
  })

  if (!user?.agencyId) {
    throw new Error('User or agency not found')
  }

  await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      xeroTokens: null,
      xeroTenantId: null,
    },
  })

  revalidatePath('/settings')
}
