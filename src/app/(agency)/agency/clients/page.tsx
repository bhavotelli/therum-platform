import { notFound, redirect } from 'next/navigation'

import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { wrapPostgrestError } from '@/lib/errors'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { ClientContactRow, ClientRow } from '@/types/database'
import ClientsManager from './ClientsManager'

export const dynamic = 'force-dynamic'

const CONTACT_ROLE_ORDER: Record<string, number> = { PRIMARY: 0, FINANCE: 1, OTHER: 2 }

export default async function ClientsPage() {
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

  const db = getSupabaseServiceRole()
  const { data: clientsRaw, error: cErr } = await db
    .from('Client')
    .select('*')
    .eq('agencyId', agencyCtx.agencyId)
    .order('updatedAt', { ascending: false })
    .limit(100)
  if (cErr) throw wrapPostgrestError(cErr)
  const clients = (clientsRaw ?? []) as ClientRow[]
  const ids = clients.map((c) => c.id)
  const { data: contactsRaw } = ids.length
    ? await db.from('ClientContact').select('*').in('clientId', ids)
    : { data: [] }
  const contacts = (contactsRaw ?? []) as ClientContactRow[]

  const byClient = new Map<string, ClientContactRow[]>()
  for (const co of contacts) {
    const list = byClient.get(co.clientId) ?? []
    list.push(co)
    byClient.set(co.clientId, list)
  }
  for (const [, list] of byClient) {
    list.sort((a, b) => {
      const ra = CONTACT_ROLE_ORDER[a.role] ?? 99
      const rb = CONTACT_ROLE_ORDER[b.role] ?? 99
      if (ra !== rb) return ra - rb
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }

  const clientIds = clients.map((c) => c.id)
  const { data: deals } = clientIds.length
    ? await db.from('Deal').select('id, clientId, stage').in('clientId', clientIds).eq('agencyId', agencyCtx.agencyId)
    : { data: [] }

  const dealsByClient = new Map<string, { total: number; active: number }>()
  for (const deal of deals ?? []) {
    const cid = deal.clientId as string
    const entry = dealsByClient.get(cid) ?? { total: 0, active: 0 }
    entry.total += 1
    if (deal.stage === 'ACTIVE' || deal.stage === 'IN_BILLING') entry.active += 1
    dealsByClient.set(cid, entry)
  }

  const payload = clients.map((client) => ({
    id: client.id,
    name: client.name,
    paymentTermsDays: client.paymentTermsDays,
    vatNumber: client.vatNumber,
    notes: client.notes,
    xeroContactId: client.xeroContactId,
    totalDeals: dealsByClient.get(client.id)?.total ?? 0,
    activeDeals: dealsByClient.get(client.id)?.active ?? 0,
    contacts: (byClient.get(client.id) ?? []).map((contact) => ({
      name: contact.name,
      email: contact.email,
      role: contact.role,
      phone: contact.phone ?? '',
      notes: contact.notes ?? '',
    })),
  }))

  return <ClientsManager clients={payload} />
}
