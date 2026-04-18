import { cookies } from 'next/headers'

import { parseImpersonationCookie } from '@/lib/impersonation'
import { xero } from '@/lib/xero'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { UserRoles } from '@/types/database'

type XeroContact = {
  contactID?: string
  name?: string
  emailAddress?: string
}

export type SyncAction = 'LINK_EXISTING' | 'CREATE_IN_XERO' | 'NO_ACTION' | 'CONFLICT'

export type TalentSyncPreviewRow = {
  id: string
  name: string
  email: string
  currentXeroContactId: string | null
  matchedXeroContactId: string | null
  candidateMatches: Array<{ id: string; label: string }>
  action: SyncAction
  reason: string
}

export type ClientSyncPreviewRow = {
  id: string
  name: string
  preferredEmail: string | null
  currentXeroContactId: string | null
  matchedXeroContactId: string | null
  candidateMatches: Array<{ id: string; label: string }>
  action: SyncAction
  reason: string
}

export type XeroContactSyncPreview = {
  xeroContactsFetched: number
  talent: TalentSyncPreviewRow[]
  clients: ClientSyncPreviewRow[]
}

type Context = {
  agencyId: string
  tenantId: string
  tokenSet: string
}

export async function getAgencyXeroContextForUser(userId?: string): Promise<Context> {
  if (!userId) {
    throw new Error('Not authenticated')
  }

  const db = getSupabaseServiceRole()
  const { data: user, error: uErr } = await db
    .from('User')
    .select('agencyId, active, role')
    .eq('id', userId)
    .maybeSingle()
  if (uErr) throw uErr

  if (!user?.active) {
    throw new Error('Not authenticated')
  }

  let agencyIdForXero: string | null =
    user.role === UserRoles.SUPER_ADMIN
      ? parseImpersonationCookie((await cookies()).get('therum_impersonation')?.value)?.agencyId ?? null
      : user.agencyId

  if (!agencyIdForXero) {
    throw new Error('No agency linked to this user')
  }

  const { data: agency, error: aErr } = await db
    .from('Agency')
    .select('id, xeroTenantId, xeroTokens')
    .eq('id', agencyIdForXero)
    .maybeSingle()
  if (aErr) throw aErr

  if (!agency?.xeroTenantId || !agency.xeroTokens) {
    throw new Error('Xero is not connected for this agency')
  }

  return {
    agencyId: agency.id,
    tenantId: agency.xeroTenantId,
    tokenSet: agency.xeroTokens,
  }
}

function buildEmailIndex(contacts: XeroContact[]) {
  const map = new Map<string, string[]>()
  for (const contact of contacts) {
    const contactId = contact.contactID
    const email = String(contact.emailAddress ?? '').trim().toLowerCase()
    if (!contactId || !email) continue
    const current = map.get(email) ?? []
    current.push(contactId)
    map.set(email, current)
  }
  return map
}

function buildNameIndex(contacts: XeroContact[]) {
  const map = new Map<string, string[]>()
  for (const contact of contacts) {
    const contactId = contact.contactID
    const name = String(contact.name ?? '').trim().toLowerCase()
    if (!contactId || !name) continue
    const current = map.get(name) ?? []
    current.push(contactId)
    map.set(name, current)
  }
  return map
}

function pickSingleMatch(ids: string[] | undefined): string | null {
  if (!ids || ids.length === 0) return null
  return ids.length === 1 ? ids[0] : null
}

export async function buildXeroContactSyncPreview(context: Context): Promise<XeroContactSyncPreview> {
  await xero.setTokenSet(JSON.parse(context.tokenSet))
  const contactsResponse = await (xero.accountingApi as any).getContacts(context.tenantId)
  const xeroContacts = (contactsResponse?.body?.contacts ?? []) as XeroContact[]
  const emailIndex = buildEmailIndex(xeroContacts)
  const nameIndex = buildNameIndex(xeroContacts)

  const db = getSupabaseServiceRole()
  const [{ data: talents }, { data: clientsRaw }] = await Promise.all([
    db
      .from('Talent')
      .select('id, name, email, xeroContactId')
      .eq('agencyId', context.agencyId)
      .order('name', { ascending: true }),
    db.from('Client').select('id, name, xeroContactId').eq('agencyId', context.agencyId).order('name', { ascending: true }),
  ])

  const clientIds = (clientsRaw ?? []).map((c) => c.id)
  const { data: contactRows } = clientIds.length
    ? await db.from('ClientContact').select('clientId, email, role').in('clientId', clientIds).order('createdAt', { ascending: true })
    : { data: [] }

  const contactsByClient = new Map<string, Array<{ email: string; role: string }>>()
  for (const row of contactRows ?? []) {
    const list = contactsByClient.get(row.clientId) ?? []
    list.push({ email: row.email, role: row.role })
    contactsByClient.set(row.clientId, list)
  }

  const clients = (clientsRaw ?? []).map((c) => ({
    ...c,
    contacts: contactsByClient.get(c.id) ?? [],
  }))

  const talentPreview: TalentSyncPreviewRow[] = (talents ?? []).map((talent) => {
    if (talent.xeroContactId) {
      return {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        currentXeroContactId: talent.xeroContactId,
        matchedXeroContactId: talent.xeroContactId,
        candidateMatches: [],
        action: 'NO_ACTION',
        reason: 'Already linked in Therum',
      }
    }

    const email = talent.email.trim().toLowerCase()
    const name = talent.name.trim().toLowerCase()
    const byEmail = emailIndex.get(email)
    const byName = nameIndex.get(name)
    const emailMatch = pickSingleMatch(byEmail)
    const nameMatch = pickSingleMatch(byName)

    if (byEmail && byEmail.length > 1) {
      const candidates = xeroContacts
        .filter((c) => byEmail.includes(c.contactID ?? ''))
        .map((c) => ({ id: c.contactID as string, label: `${c.name ?? 'Unnamed'} · ${c.emailAddress ?? 'No email'}` }))
      return {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        currentXeroContactId: null,
        matchedXeroContactId: null,
        candidateMatches: candidates,
        action: 'CONFLICT',
        reason: 'Multiple Xero contacts share this email',
      }
    }
    if (byName && byName.length > 1) {
      const candidates = xeroContacts
        .filter((c) => byName.includes(c.contactID ?? ''))
        .map((c) => ({ id: c.contactID as string, label: `${c.name ?? 'Unnamed'} · ${c.emailAddress ?? 'No email'}` }))
      return {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        currentXeroContactId: null,
        matchedXeroContactId: null,
        candidateMatches: candidates,
        action: 'CONFLICT',
        reason: 'Multiple Xero contacts share this name',
      }
    }

    const match = emailMatch ?? nameMatch
    if (match) {
      return {
        id: talent.id,
        name: talent.name,
        email: talent.email,
        currentXeroContactId: null,
        matchedXeroContactId: match,
        candidateMatches: [],
        action: 'LINK_EXISTING',
        reason: emailMatch ? 'Matched by email' : 'Matched by name',
      }
    }

    return {
      id: talent.id,
      name: talent.name,
      email: talent.email,
      currentXeroContactId: null,
      matchedXeroContactId: null,
      candidateMatches: [],
      action: 'CREATE_IN_XERO',
      reason: 'No existing Xero contact match',
    }
  })

  const clientPreview: ClientSyncPreviewRow[] = clients.map((client) => {
    const preferredContact =
      client.contacts.find((c) => c.role === 'FINANCE') ??
      client.contacts.find((c) => c.role === 'PRIMARY') ??
      client.contacts[0]
    const preferredEmail = preferredContact?.email?.trim() || null

    if (client.xeroContactId) {
      return {
        id: client.id,
        name: client.name,
        preferredEmail,
        currentXeroContactId: client.xeroContactId,
        matchedXeroContactId: client.xeroContactId,
        candidateMatches: [],
        action: 'NO_ACTION',
        reason: 'Already linked in Therum',
      }
    }

    const email = preferredEmail?.toLowerCase() ?? ''
    const name = client.name.trim().toLowerCase()
    const byEmail = email ? emailIndex.get(email) : undefined
    const byName = nameIndex.get(name)
    const emailMatch = pickSingleMatch(byEmail)
    const nameMatch = pickSingleMatch(byName)

    if (byEmail && byEmail.length > 1) {
      const candidates = xeroContacts
        .filter((c) => byEmail.includes(c.contactID ?? ''))
        .map((c) => ({ id: c.contactID as string, label: `${c.name ?? 'Unnamed'} · ${c.emailAddress ?? 'No email'}` }))
      return {
        id: client.id,
        name: client.name,
        preferredEmail,
        currentXeroContactId: null,
        matchedXeroContactId: null,
        candidateMatches: candidates,
        action: 'CONFLICT',
        reason: 'Multiple Xero contacts share preferred email',
      }
    }
    if (byName && byName.length > 1) {
      const candidates = xeroContacts
        .filter((c) => byName.includes(c.contactID ?? ''))
        .map((c) => ({ id: c.contactID as string, label: `${c.name ?? 'Unnamed'} · ${c.emailAddress ?? 'No email'}` }))
      return {
        id: client.id,
        name: client.name,
        preferredEmail,
        currentXeroContactId: null,
        matchedXeroContactId: null,
        candidateMatches: candidates,
        action: 'CONFLICT',
        reason: 'Multiple Xero contacts share this name',
      }
    }

    const match = emailMatch ?? nameMatch
    if (match) {
      return {
        id: client.id,
        name: client.name,
        preferredEmail,
        currentXeroContactId: null,
        matchedXeroContactId: match,
        candidateMatches: [],
        action: 'LINK_EXISTING',
        reason: emailMatch ? 'Matched by FINANCE/PRIMARY email' : 'Matched by client name',
      }
    }

    return {
      id: client.id,
      name: client.name,
      preferredEmail,
      currentXeroContactId: null,
      matchedXeroContactId: null,
      candidateMatches: [],
      action: 'CREATE_IN_XERO',
      reason: 'No existing Xero contact match',
    }
  })

  return {
    xeroContactsFetched: xeroContacts.length,
    talent: talentPreview,
    clients: clientPreview,
  }
}
