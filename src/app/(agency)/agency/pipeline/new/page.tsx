import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

import NewDealForm from './NewDealForm'

export default async function NewDealPage() {
  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_login') {
    redirect('/login')
  }
  if (agencyCtx.status === 'forbidden' || agencyCtx.status === 'need_impersonation') {
    notFound()
  }
  if (agencyCtx.status === 'no_agency') {
    return (
      <div className="flex items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white p-20">
        <p className="text-gray-500">No agency linked to this user yet.</p>
      </div>
    )
  }

  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('id').eq('id', agencyCtx.agencyId).maybeSingle()

  if (!agency) {
    return (
      <div className="flex items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white p-20">
        <p className="text-gray-500">Agency not found.</p>
      </div>
    )
  }

  const [clientsRes, talentsRes] = await Promise.all([
    db.from('Client').select('id, name').eq('agencyId', agency.id).order('name', { ascending: true }),
    db.from('Talent').select('id, name').eq('agencyId', agency.id).order('name', { ascending: true }),
  ])

  const clients = clientsRes.data ?? []
  const talents = talentsRes.data ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/deals" className="transition-colors hover:text-indigo-600">
          Deals
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Deal</span>
      </nav>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1A244E]">Create New Deal</h1>
        <p className="mt-2 text-gray-500">Enter the campaign details and define the billing milestones.</p>
      </div>

      <NewDealForm agencyId={agency.id} clients={clients} talents={talents} />
    </div>
  )
}
