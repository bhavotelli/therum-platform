import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export default async function TalentRosterPage() {
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
  const { data: talents } = await db
    .from('Talent')
    .select('id, name, email, vatRegistered, commissionRate')
    .eq('agencyId', agencyCtx.agencyId)
    .order('name', { ascending: true })
    .limit(100)

  const list = talents ?? []
  const talentIds = list.map((t) => t.id)

  const { data: deals } = talentIds.length
    ? await db.from('Deal').select('id, talentId, stage').in('talentId', talentIds).eq('agencyId', agencyCtx.agencyId)
    : { data: [] }

  const dealsByTalent = new Map<string, { total: number; active: number }>()
  for (const deal of deals ?? []) {
    const tid = deal.talentId as string
    const entry = dealsByTalent.get(tid) ?? { total: 0, active: 0 }
    entry.total += 1
    if (deal.stage === 'ACTIVE' || deal.stage === 'IN_BILLING') entry.active += 1
    dealsByTalent.set(tid, entry)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Talent Roster</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{list.length} talent{list.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/agency/talent-roster/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          + Add Talent
        </Link>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <p className="text-sm font-semibold text-blue-900">Talent Portal Testing</p>
        <p className="mt-1 text-sm text-blue-800">
          During beta, agency users should test portal UX through preview mode rather than asking talent to log in.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
          <p className="font-medium text-zinc-500">Add talent records to begin portal preview testing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((talent) => {
            const stats = dealsByTalent.get(talent.id) ?? { total: 0, active: 0 }
            return (
              <Link
                key={talent.id}
                href={`/agency/talent-roster/${talent.id}`}
                className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Accent bar */}
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400 group-hover:bg-indigo-500 transition-colors" />

                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <h2 className="text-sm font-bold text-zinc-900 group-hover:text-blue-700 transition-colors uppercase tracking-tight">
                      {talent.name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{talent.email}</p>
                  </div>

                  {/* Deal stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Deals</p>
                      <p className="text-lg font-bold text-zinc-900 tabular-nums">{stats.total}</p>
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${stats.active > 0 ? 'border-blue-100 bg-blue-50' : 'border-zinc-100 bg-zinc-50'}`}>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${stats.active > 0 ? 'text-blue-500' : 'text-zinc-400'}`}>Active</p>
                      <p className={`text-lg font-bold tabular-nums ${stats.active > 0 ? 'text-blue-700' : 'text-zinc-900'}`}>{stats.active}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 uppercase tracking-wider">
                      {talent.commissionRate}% Commission
                    </span>
                    {talent.vatRegistered && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                        VAT Registered
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">View Profile</span>
                  <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
