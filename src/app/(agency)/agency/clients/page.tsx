import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import ClientsManager from './ClientsManager'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyId: true },
  })
  if (!user?.agencyId) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">
        No agency linked to this user yet.
      </div>
    )
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: user.agencyId },
    include: {
      contacts: {
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  const payload = clients.map((client) => ({
    id: client.id,
    name: client.name,
    paymentTermsDays: client.paymentTermsDays,
    vatNumber: client.vatNumber,
    notes: client.notes,
    xeroContactId: client.xeroContactId,
    contacts: client.contacts.map((contact) => ({
      name: contact.name,
      email: contact.email,
      role: contact.role,
      phone: contact.phone ?? '',
      notes: contact.notes ?? '',
    })),
  }))

  return <ClientsManager clients={payload} />
}
