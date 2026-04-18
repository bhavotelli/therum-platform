import prisma from '@/lib/prisma'
import EditDealForm from './EditDealForm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { resolveAgencyPageContext } from '@/lib/agencyAuth'

export default async function EditDealPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { id } = params

  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_login') {
    redirect('/login')
  }
  if (agencyCtx.status === 'forbidden' || agencyCtx.status === 'need_impersonation') {
    notFound()
  }
  if (agencyCtx.status === 'no_agency') {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">
        No agency linked to this user yet.
      </div>
    )
  }

  // 1. Fetch deal with milestones (scoped to viewer agency)
  const deal = await prisma.deal.findFirst({
    where: { id, agencyId: agencyCtx.agencyId },
    include: {
      milestones: {
        orderBy: { invoiceDate: 'asc' }
      }
    }
  })

  if (!deal) notFound()

  // 2. Fetch clients and talents for dropdowns
  const [clientsRaw, talentsRaw] = await Promise.all([
    prisma.client.findMany({ 
      where: { agencyId: deal.agencyId },
      orderBy: { name: 'asc' }
    }),
    prisma.talent.findMany({ 
      where: { agencyId: deal.agencyId },
      orderBy: { name: 'asc' }
    })
  ])

  // Fix serialization
  const clients = clientsRaw.map(c => ({ id: c.id, name: c.name }))
  const talents = talentsRaw.map(t => ({ id: t.id, name: t.name }))
  
  const serializedDeal = {
    ...deal,
    commissionRate: deal.commissionRate.toString(),
    milestones: deal.milestones.map(m => ({
      ...m,
      grossAmount: m.grossAmount.toString()
    }))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/agency/pipeline" className="hover:text-indigo-600 transition-colors">Deals</Link>
        <span>/</span>
        <Link href={`/agency/pipeline/${deal.id}`} className="hover:text-indigo-600 transition-colors">{deal.title}</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Edit</span>
      </nav>

      <div>
        <h1 className="text-3xl font-extrabold text-[#1A244E] tracking-tight">
          Edit Deal
        </h1>
        <p className="mt-2 text-gray-500">
          Modify deal terms, update stages, or manage milestones.
        </p>
      </div>

      <EditDealForm 
        deal={serializedDeal as any} 
        clients={clients} 
        talents={talents} 
      />
    </div>
  )
}
