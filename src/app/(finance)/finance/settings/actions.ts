'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireFinanceAgencyId } from '@/lib/financeAuth'

export async function disconnectXero() {
  const agencyId = await requireFinanceAgencyId({ requireWriteAccess: true })

  await prisma.agency.update({
    where: { id: agencyId },
    data: {
      xeroTokens: null,
      xeroTenantId: null,
    },
  })

  revalidatePath('/finance/settings')
}
