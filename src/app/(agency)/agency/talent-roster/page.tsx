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
    .select('id, name, email')
    .eq('agencyId', agencyCtx.agencyId)
    .order('createdAt', { ascending: false })
    .limit(50)

  const list = talents ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Talent Roster</h1>
        <Link
          href="/agency/talent-roster/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Add Talent
        </Link>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <p className="text-sm font-semibold text-blue-900">Talent Portal Testing</p>
        <p className="mt-1 text-sm text-blue-800">
          During beta, agency users should test portal UX through preview mode rather than asking talent to log in.
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
            <p className="font-medium text-zinc-500">Add talent records to begin portal preview testing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((talent) => (
              <div
                key={talent.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3"
              >
                <div>
                  <Link href={`/agency/talent-roster/${talent.id}`} className="text-sm font-semibold text-zinc-900 hover:text-blue-700">
                    {talent.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{talent.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/agency/talent-roster/${talent.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/talent/preview/${talent.id}/dashboard`}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
                  >
                    Preview Portal
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
