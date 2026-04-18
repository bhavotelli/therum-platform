'use server'

import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireFinanceAgencyId } from '@/lib/financeAuth'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { syncInvoiceFromXeroEvent } from '@/lib/xero-sync'
import { xero } from '@/lib/xero'
import { buildXeroContactSyncPreview, getAgencyXeroContextForUser } from '@/lib/xero-contact-sync'

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

export async function pullLatestXeroPaidStatuses() {
  const agencyId = await requireFinanceAgencyId({ requireWriteAccess: true })
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, xeroTenantId: true },
  })

  if (!agency?.xeroTenantId) {
    throw new Error('Xero is not connected for this agency')
  }

  const candidates = await prisma.invoiceTriplet.findMany({
    where: {
      milestone: {
        deal: {
          agencyId: agency.id,
        },
      },
      approvalStatus: 'APPROVED',
      invPaidAt: null,
      OR: [
        { xeroInvId: { not: null } },
        { xeroObiId: { not: null } },
      ],
    },
    select: {
      xeroInvId: true,
      xeroObiId: true,
    },
    take: 100,
  })

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
  let talentsLinked = 0
  for (const talent of preview.talent) {
    if (talent.action !== 'LINK_EXISTING' || !talent.matchedXeroContactId) continue
    await prisma.talent.updateMany({
      where: { id: talent.id, agencyId: context.agencyId },
      data: { xeroContactId: talent.matchedXeroContactId },
    })
    talentsLinked += 1
  }

  let clientsLinked = 0
  for (const client of preview.clients) {
    if (client.action !== 'LINK_EXISTING' || !client.matchedXeroContactId) continue
    await prisma.client.updateMany({
      where: { id: client.id, agencyId: context.agencyId },
      data: { xeroContactId: client.matchedXeroContactId },
    })
    clientsLinked += 1
  }

  await prisma.adminAuditLog.create({
    data: {
      action: 'XERO_CONTACT_SYNC_PULL',
      targetType: 'XERO_CONTACT',
      metadata: {
        xeroContactsFetched: preview.xeroContactsFetched,
        talentsLinked,
        clientsLinked,
      },
    },
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
  await xero.setTokenSet(JSON.parse(context.tokenSet))
  const preview = await buildXeroContactSyncPreview(context)

  let talentsLinked = 0
  let talentsCreated = 0
  const accountingApi = xero.accountingApi as {
    createContacts: (tenantId: string, payload: unknown) => Promise<XeroContactCreateResponse>
  }
  for (const talent of preview.talent) {
    if (talent.action === 'CONFLICT' || talent.action === 'NO_ACTION') continue
    let match = talent.matchedXeroContactId
    if (!match && talent.action === 'CREATE_IN_XERO') {
      const createResponse = await accountingApi.createContacts(context.tenantId, {
        contacts: [
          {
            name: talent.name,
            emailAddress: talent.email,
          },
        ],
      })
      const createdContact = (createResponse?.body?.contacts?.[0] ?? null) as { contactID?: string } | null
      match = createdContact?.contactID ?? null
      if (!match) continue
      talentsCreated += 1
    }

    await prisma.talent.updateMany({
      where: { id: talent.id, agencyId: context.agencyId },
      data: { xeroContactId: match },
    })
    talentsLinked += 1
  }

  let clientsLinked = 0
  let clientsCreated = 0
  const clientsWithContacts = await prisma.client.findMany({
    where: {
      id: { in: preview.clients.map((row) => row.id) },
      agencyId: context.agencyId,
    },
    select: {
      id: true,
      contacts: {
        select: { name: true, email: true, role: true, phone: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  const clientContactsById = new Map(clientsWithContacts.map((row) => [row.id, row.contacts]))

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

      const createResponse = await accountingApi.createContacts(context.tenantId, {
        contacts: [
          {
            name: client.name,
            emailAddress: client.preferredEmail ?? undefined,
            isCustomer: true,
            contactPersons,
            contactGroups: [],
          },
        ],
      })
      const createdContact = (createResponse?.body?.contacts?.[0] ?? null) as { contactID?: string } | null
      match = createdContact?.contactID ?? null
      if (!match) continue
      clientsCreated += 1
    }

    await prisma.client.updateMany({
      where: { id: client.id, agencyId: context.agencyId },
      data: { xeroContactId: match },
    })
    clientsLinked += 1
  }

  await prisma.adminAuditLog.create({
    data: {
      action: 'XERO_CONTACT_SYNC_PUSH',
      targetType: 'XERO_CONTACT',
      metadata: {
        talentsCreated,
        talentsLinked,
        clientsCreated,
        clientsLinked,
      },
    },
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

  if (recordType === 'TALENT') {
    await prisma.talent.update({
      where: { id: recordId, agencyId: context.agencyId },
      data: { xeroContactId },
    })
  } else if (recordType === 'CLIENT') {
    await prisma.client.update({
      where: { id: recordId, agencyId: context.agencyId },
      data: { xeroContactId },
    })
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
  const agencyId = await requireFinanceAgencyId({ requireWriteAccess: true })
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      invoicingModel: true,
      xeroAccountCodes: true,
    },
  })

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

  await prisma.agency.update({
    where: { id: agency.id },
    data: {
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
      },
    },
  })

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
  await xero.setTokenSet(JSON.parse(context.tokenSet))

  const orgApi = xero.accountingApi as {
    getOrganisations: (tenantId: string) => Promise<{ body?: { organisations?: XeroOrganisation[] } }>
  }
  const response = await orgApi.getOrganisations(context.tenantId)
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

  const agency = await prisma.agency.findUnique({
    where: { id: context.agencyId },
    select: { xeroAccountCodes: true },
  })
  const existing = agency?.xeroAccountCodes && typeof agency.xeroAccountCodes === 'object'
    ? (agency.xeroAccountCodes as Record<string, unknown>)
    : {}

  await prisma.agency.update({
    where: { id: context.agencyId },
    data: {
      xeroAccountCodes: {
        ...existing,
        xeroOrgProfile: {
          registeredName: registeredName ?? null,
          registeredAddress: registeredAddress ?? null,
        },
      },
    },
  })

  await prisma.adminAuditLog.create({
    data: {
      action: 'XERO_ORG_PROFILE_REFRESHED',
      targetType: 'AGENCY',
      targetId: context.agencyId,
      metadata: {
        registeredName: registeredName ?? null,
        registeredAddress: registeredAddress ?? null,
      },
    },
  })

  revalidatePath('/finance/xero-sync')
  revalidatePath('/finance/settings')
}
