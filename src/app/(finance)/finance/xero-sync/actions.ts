'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { insertAdminAuditLog } from '@/lib/db/admin-audit-log'
import { requireFinanceAgencyId } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { xero } from '@/lib/xero'
import { syncInvoiceFromXeroEvent, translateXeroApiError, withXeroRetry } from '@/lib/xero-sync'
import { getMilestoneIdsForAgency } from '@/lib/db/agency-queries'
import { buildXeroContactSyncPreview, getAgencyXeroContextForUser } from '@/lib/xero-contact-sync'
import type { Json } from '@/types/database'

type MappingInput = {
  inv?: string | null
  sbi?: string | null
  obi?: string | null
  cn?: string | null
  com?: string | null
  expenses?: string | null
}

type XeroContactCreateResponse = {
  body?: {
    contacts?: Array<{ contactID?: string }>
  }
}

type XeroOrganisationAddress = {
  addressType?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
}

type XeroOrganisation = {
  legalName?: string
  name?: string
  addresses?: XeroOrganisationAddress[]
}

function throwXeroContactCreationFailure(
  entityType: 'talent' | 'client',
  entityId: string,
  ctx: { agencyId: string; tenantId: string },
  responseBody: XeroContactCreateResponse['body'] | undefined,
): never {
  // Xero returned 2xx but no contactID — the contact may still have been
  // created in Xero, leaving an orphan Therum will never link. Log structural
  // metadata of the response (enough for triage, without dumping a third-party
  // payload we do not control) and surface the failure so the operator is
  // aware instead of silently re-running the sync.
  const firstContact = responseBody?.contacts?.[0]
  console.error(`[XERO SYNC] createContacts ${entityType} returned 2xx without contactID`, {
    [`${entityType}Id`]: entityId,
    agencyId: ctx.agencyId,
    tenantId: ctx.tenantId,
    responseShape: {
      contactsLength: responseBody?.contacts?.length ?? null,
      firstContactKeys: firstContact ? Object.keys(firstContact) : null,
    },
  })
  throw new Error(
    `[Xero] createContacts ${entityType} (${entityId}): ` +
      `returned 2xx but no contactID; manual cleanup may be required in Xero`,
  )
}

export async function pullLatestXeroPaidStatuses() {
  const agencyId = await requireFinanceAgencyId()
  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('id, xeroTenantId').eq('id', agencyId).maybeSingle()

  if (!agency?.xeroTenantId) {
    throw new Error('Xero is not connected for this agency')
  }

  const mids = await getMilestoneIdsForAgency(agency.id as string)
  const { data: tripRows } =
    mids.length > 0
      ? await db
          .from('InvoiceTriplet')
          .select('xeroInvId, xeroObiId')
          .in('milestoneId', mids)
          .eq('approvalStatus', 'APPROVED')
          .is('invPaidAt', null)
          .limit(200)
      : { data: [] }
  const candidates = (tripRows ?? []).filter((t) => t.xeroInvId || t.xeroObiId).slice(0, 100)

  for (const candidate of candidates) {
    const resourceId = candidate.xeroInvId ?? candidate.xeroObiId
    if (!resourceId) continue
    await syncInvoiceFromXeroEvent({
      tenantId: agency.xeroTenantId,
      resourceId,
    })
  }

  revalidatePath('/finance/xero-sync')
  revalidatePath('/finance/payouts')
  revalidatePath('/finance/overdue')
  revalidatePath('/finance/dashboard')
  revalidatePath('/agency/pipeline')
}

export async function pullLatestXeroContactAndTalentSync() {
  const appUser = await resolveAppUser()
  if (!appUser) {
    redirect('/login')
  }

  const userId = appUser.id
  const context = await getAgencyXeroContextForUser(userId)
  const preview = await buildXeroContactSyncPreview(context)
  const db = getSupabaseServiceRole()
  let talentsLinked = 0
  for (const talent of preview.talent) {
    if (talent.action !== 'LINK_EXISTING' || !talent.matchedXeroContactId) continue
    await db
      .from('Talent')
      .update({ xeroContactId: talent.matchedXeroContactId })
      .eq('id', talent.id)
      .eq('agencyId', context.agencyId)
    talentsLinked += 1
  }

  let clientsLinked = 0
  for (const client of preview.clients) {
    if (client.action !== 'LINK_EXISTING' || !client.matchedXeroContactId) continue
    await db
      .from('Client')
      .update({ xeroContactId: client.matchedXeroContactId })
      .eq('id', client.id)
      .eq('agencyId', context.agencyId)
    clientsLinked += 1
  }

  await insertAdminAuditLog({
    action: 'XERO_CONTACT_SYNC_PULL',
    targetType: 'XERO_CONTACT',
    metadata: {
      xeroContactsFetched: preview.xeroContactsFetched,
      talentsLinked,
      clientsLinked,
    } as Json,
  })

  revalidatePath('/finance/xero-sync')
  revalidatePath('/agency/talent-roster')
  revalidatePath('/agency/clients')
  revalidatePath('/agency/pipeline')
}

export async function pushMissingXeroContactsAndTalentLinks() {
  const appUser = await resolveAppUser()
  if (!appUser) {
    redirect('/login')
  }

  const userId = appUser.id
  const context = await getAgencyXeroContextForUser(userId)
  try {
    await xero.setTokenSet(JSON.parse(context.tokenSet))
  } catch (setTokenError) {
    throw translateXeroApiError(`setTokenSet (push missing contacts, agency ${context.agencyId})`, setTokenError)
  }
  const preview = await buildXeroContactSyncPreview(context)
  const db = getSupabaseServiceRole()

  let talentsLinked = 0
  let talentsCreated = 0
  const accountingApi = xero.accountingApi as {
    createContacts: (tenantId: string, payload: unknown) => Promise<XeroContactCreateResponse>
  }
  const { data: talentRows } = await db
    .from('Talent')
    .select('id, vatNumber, vatRegistered')
    .eq('agencyId', context.agencyId)
  const talentVatMap = new Map((talentRows ?? []).map((t) => [t.id, { vatNumber: t.vatNumber, vatRegistered: t.vatRegistered }]))

  for (const talent of preview.talent) {
    if (talent.action === 'CONFLICT' || talent.action === 'NO_ACTION') continue
    let match = talent.matchedXeroContactId
    if (!match && talent.action === 'CREATE_IN_XERO') {
      const talentVat = talentVatMap.get(talent.id)
      const createResponse = await withXeroRetry(
        context.agencyId,
        `createContacts talent (talent ${talent.id}, agency ${context.agencyId})`,
        () =>
          accountingApi.createContacts(context.tenantId, {
            contacts: [
              {
                name: talent.name,
                emailAddress: talent.email,
                // SELF_BILLING raises ACCPAY for SBI (Talent is the supplier
                // the agency owes) AND ACCREC for COM (Talent is the customer
                // being charged commission), so on that model both flags are
                // strictly required — without IsSupplier the SBI push fails
                // Xero validation. ON_BEHALF only raises ACCREC today (OBI on
                // the client + COM on the talent), so IsSupplier isn't
                // strictly required there, but we set it unconditionally so a
                // later invoicing-model switch doesn't require a Xero re-sync.
                isCustomer: true,
                isSupplier: true,
                ...(talentVat?.vatRegistered && talentVat.vatNumber ? { taxNumber: talentVat.vatNumber } : {}),
              },
            ],
          }),
      )
      const createdContact = (createResponse?.body?.contacts?.[0] ?? null) as { contactID?: string } | null
      match = createdContact?.contactID ?? null
      if (!match) {
        throwXeroContactCreationFailure('talent', talent.id, context, createResponse?.body)
      }
      talentsCreated += 1
    }

    await db.from('Talent').update({ xeroContactId: match }).eq('id', talent.id).eq('agencyId', context.agencyId)
    talentsLinked += 1
  }

  let clientsLinked = 0
  let clientsCreated = 0
  const clientIds = preview.clients.map((row) => row.id)
  const clientContactsById = new Map<
    string,
    Array<{ name: string; email: string; role: string; phone: string | null }>
  >()
  if (clientIds.length > 0) {
    const { data: validClients } = await db.from('Client').select('id').in('id', clientIds).eq('agencyId', context.agencyId)
    const validIds = (validClients ?? []).map((c) => c.id as string)
    if (validIds.length > 0) {
      const { data: contactRows } = await db
        .from('ClientContact')
        .select('clientId, name, email, role, phone, createdAt')
        .in('clientId', validIds)
        .order('createdAt', { ascending: true })
      for (const contact of contactRows ?? []) {
        const cid = contact.clientId as string
        const arr = clientContactsById.get(cid) ?? []
        arr.push({
          name: contact.name as string,
          email: contact.email as string,
          role: contact.role as string,
          phone: (contact.phone as string | null) ?? null,
        })
        clientContactsById.set(cid, arr)
      }
    }
  }

  for (const client of preview.clients) {
    if (client.action === 'CONFLICT' || client.action === 'NO_ACTION') continue
    let match = client.matchedXeroContactId

    if (!match && client.action === 'CREATE_IN_XERO') {
      const contactPersons = (clientContactsById.get(client.id) ?? []).slice(0, 5).map((contact) => ({
        firstName: contact.name.split(' ')[0] || contact.name,
        lastName: contact.name.split(' ').slice(1).join(' ') || '.',
        emailAddress: contact.email,
        includeInEmails: contact.role === 'FINANCE',
      }))

      const createResponse = await withXeroRetry(
        context.agencyId,
        `createContacts client (client ${client.id}, agency ${context.agencyId})`,
        () =>
          accountingApi.createContacts(context.tenantId, {
            contacts: [
              {
                name: client.name,
                emailAddress: client.preferredEmail ?? undefined,
                isCustomer: true,
                contactPersons,
                contactGroups: [],
              },
            ],
          }),
      )
      const createdContact = (createResponse?.body?.contacts?.[0] ?? null) as { contactID?: string } | null
      match = createdContact?.contactID ?? null
      if (!match) {
        throwXeroContactCreationFailure('client', client.id, context, createResponse?.body)
      }
      clientsCreated += 1
    }

    await db.from('Client').update({ xeroContactId: match }).eq('id', client.id).eq('agencyId', context.agencyId)
    clientsLinked += 1
  }

  await insertAdminAuditLog({
    action: 'XERO_CONTACT_SYNC_PUSH',
    targetType: 'XERO_CONTACT',
    metadata: {
      talentsCreated,
      talentsLinked,
      clientsCreated,
      clientsLinked,
    } as Json,
  })

  revalidatePath('/finance/xero-sync')
  revalidatePath('/agency/talent-roster')
  revalidatePath('/agency/clients')
  revalidatePath('/agency/pipeline')
}

export async function resolveXeroContactConflict(formData: FormData) {
  const appUser = await resolveAppUser()
  if (!appUser) {
    redirect('/login')
  }

  const userId = appUser.id
  const context = await getAgencyXeroContextForUser(userId)
  const recordType = String(formData.get('recordType') ?? '')
  const recordId = String(formData.get('recordId') ?? '')
  const xeroContactId = String(formData.get('xeroContactId') ?? '')

  if (!recordId || !xeroContactId) {
    throw new Error('Missing conflict resolution fields')
  }

  const db = getSupabaseServiceRole()
  if (recordType === 'TALENT') {
    const { error } = await db
      .from('Talent')
      .update({ xeroContactId })
      .eq('id', recordId)
      .eq('agencyId', context.agencyId)
    if (error) throw new Error(error.message)
  } else if (recordType === 'CLIENT') {
    const { error } = await db
      .from('Client')
      .update({ xeroContactId })
      .eq('id', recordId)
      .eq('agencyId', context.agencyId)
    if (error) throw new Error(error.message)
  } else {
    throw new Error('Invalid record type')
  }

  revalidatePath('/finance/xero-sync')
  revalidatePath('/agency/talent-roster')
  revalidatePath('/agency/clients')
  revalidatePath('/agency/pipeline')
}

function normalizeMappingValue(value: string | null): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length ? trimmed : null
}

export async function saveXeroAccountCodeMappings(formData: FormData) {
  const agencyId = await requireFinanceAgencyId()
  const db = getSupabaseServiceRole()
  const { data: agency } = await db
    .from('Agency')
    .select('id, invoicingModel, xeroAccountCodes')
    .eq('id', agencyId)
    .maybeSingle()

  if (!agency) {
    throw new Error('Agency not found')
  }

  const mapping: MappingInput = {
    inv: normalizeMappingValue(String(formData.get('inv') ?? '')),
    sbi: normalizeMappingValue(String(formData.get('sbi') ?? '')),
    obi: normalizeMappingValue(String(formData.get('obi') ?? '')),
    cn: normalizeMappingValue(String(formData.get('cn') ?? '')),
    com: normalizeMappingValue(String(formData.get('com') ?? '')),
    expenses: normalizeMappingValue(String(formData.get('expenses') ?? '')),
  }

  const requiredSelfBilling = [mapping.inv, mapping.sbi, mapping.com]
  const requiredOnBehalf = [mapping.obi, mapping.cn, mapping.com]
  const missingRequired =
    agency.invoicingModel === 'SELF_BILLING'
      ? requiredSelfBilling.some((v) => !v)
      : requiredOnBehalf.some((v) => !v)

  if (missingRequired) {
    throw new Error('Missing required account code mappings for current invoicing model')
  }

  const existing = agency.xeroAccountCodes && typeof agency.xeroAccountCodes === 'object'
    ? (agency.xeroAccountCodes as Record<string, unknown>)
    : {}

  await db
    .from('Agency')
    .update({
      xeroAccountCodes: {
        ...existing,
        mappings: {
          inv: mapping.inv,
          sbi: mapping.sbi,
          obi: mapping.obi,
          cn: mapping.cn,
          com: mapping.com,
          expenses: mapping.expenses,
        },
      } as Json,
    })
    .eq('id', agency.id as string)

  revalidatePath('/finance/xero-sync')
  revalidatePath('/finance/settings')
}

export async function refreshXeroOrganisationProfile() {
  const appUser = await resolveAppUser()
  if (!appUser) {
    redirect('/login')
  }

  const userId = appUser.id
  const context = await getAgencyXeroContextForUser(userId)
  try {
    await xero.setTokenSet(JSON.parse(context.tokenSet))
  } catch (setTokenError) {
    throw translateXeroApiError(`setTokenSet (org profile refresh, agency ${context.agencyId})`, setTokenError)
  }

  const orgApi = xero.accountingApi as {
    getOrganisations: (tenantId: string) => Promise<{ body?: { organisations?: XeroOrganisation[] } }>
  }
  const response = await withXeroRetry(
    context.agencyId,
    `getOrganisations (org profile refresh, agency ${context.agencyId})`,
    () => orgApi.getOrganisations(context.tenantId),
  )
  const org = (response?.body?.organisations?.[0] ?? null) as XeroOrganisation | null
  if (!org) {
    throw new Error('Unable to fetch Xero organisation profile')
  }

  const addresses = Array.isArray(org.addresses) ? org.addresses : []
  const primaryAddress =
    addresses.find((address: XeroOrganisationAddress) => address?.addressType === 'POBOX') ??
    addresses.find((address: XeroOrganisationAddress) => address?.addressType === 'STREET') ??
    addresses[0] ??
    null
  const registeredAddress = primaryAddress
    ? [
        primaryAddress.addressLine1,
        primaryAddress.addressLine2,
        primaryAddress.city,
        primaryAddress.region,
        primaryAddress.postalCode,
        primaryAddress.country,
      ]
        .filter((part: unknown): part is string => typeof part === 'string' && part.trim().length > 0)
        .join(', ')
    : null
  const registeredName =
    (typeof org.legalName === 'string' && org.legalName.trim().length > 0 ? org.legalName : null) ??
    (typeof org.name === 'string' && org.name.trim().length > 0 ? org.name : null)

  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('xeroAccountCodes').eq('id', context.agencyId).maybeSingle()
  const existing = agency?.xeroAccountCodes && typeof agency.xeroAccountCodes === 'object'
    ? (agency.xeroAccountCodes as Record<string, unknown>)
    : {}

  await db
    .from('Agency')
    .update({
      xeroAccountCodes: {
        ...existing,
        xeroOrgProfile: {
          registeredName: registeredName ?? null,
          registeredAddress: registeredAddress ?? null,
        },
      } as Json,
    })
    .eq('id', context.agencyId)

  await insertAdminAuditLog({
    action: 'XERO_ORG_PROFILE_REFRESHED',
    targetType: 'AGENCY',
    targetId: context.agencyId,
    metadata: {
      registeredName: registeredName ?? null,
      registeredAddress: registeredAddress ?? null,
    } as Json,
  })

  revalidatePath('/finance/xero-sync')
  revalidatePath('/finance/settings')
}
