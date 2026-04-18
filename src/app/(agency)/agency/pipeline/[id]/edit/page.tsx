import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

import EditDealForm from './EditDealForm'

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
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">No agency linked to this user yet.</div>
    )
  }

  const db = getSupabaseServiceRole()
  const { data: dealRow, error } = await db
    .from('Deal')
    .select(
      `*,
      Milestone (*)
    `,
    )
    .eq('id', id)
    .eq('agencyId', agencyCtx.agencyId)
    .maybeSingle()

  if (error || !dealRow) {
    notFound()
  }

  const { Milestone: miles, ...deal } = dealRow as typeof dealRow & { Milestone?: Record<string, unknown>[] }
  const milestones = [...(miles ?? [])].sort((a, b) =>
    String(a.invoiceDate ?? '').localeCompare(String(b.invoiceDate ?? '')),
  )

  const [clientsRes, talentsRes] = await Promise.all([
    db.from('Client').select('id, name').eq('agencyId', deal.agencyId).order('name', { ascending: true }),
    db.from('Talent').select('id, name').eq('agencyId', deal.agencyId).order('name', { ascending: true }),
  ])

  const clients = clientsRes.data ?? []
  const talents = talentsRes.data ?? []

  const serializedDeal = {
    ...deal,
    commissionRate: String(deal.commissionRate),
    milestones: milestones.map((m) => ({
      ...m,
      grossAmount: String(m.grossAmount),
    })),
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/agency/pipeline" className="transition-colors hover:text-indigo-600">
          Deals
        </Link>
        <span>/</span>
        <Link href={`/agency/pipeline/${deal.id}`} className="transition-colors hover:text-indigo-600">
          {deal.title as string}
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">Edit</span>
      </nav>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1A244E]">Edit Deal</h1>
        <p className="mt-2 text-gray-500">Modify deal terms, update stages, or manage milestones.</p>
      </div>

      <EditDealForm deal={serializedDeal as never} clients={clients} talents={talents} />
    </div>
  )
}
