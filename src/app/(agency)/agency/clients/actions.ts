'use server'

import { revalidatePath } from 'next/cache'
import type { ContactRole } from '@/types/database'
import { getAgencySessionContext } from '@/lib/agencyAuth'
import { wrapPostgrestError } from '@/lib/errors'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

type ContactInput = {
  name: string
  email: string
  role: ContactRole
  phone?: string
  notes?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function parseContacts(raw: string): ContactInput[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid contacts payload')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Contacts payload must be an array')
  }
  return parsed.map((row) => {
    const obj = row as Partial<ContactInput>
    return {
      name: String(obj.name ?? '').trim(),
      email: String(obj.email ?? '').trim(),
      role: String(obj.role ?? 'OTHER') as ContactRole,
      phone: obj.phone ? String(obj.phone).trim() : undefined,
      notes: obj.notes ? String(obj.notes).trim() : undefined,
    }
  })
}

function validateContacts(contacts: ContactInput[]) {
  if (contacts.length === 0) throw new Error('At least one client contact is required.')
  if (contacts.length > 5) throw new Error('Maximum 5 contacts per client for MVP.')

  const primaryCount = contacts.filter((c) => c.role === 'PRIMARY').length
  const financeCount = contacts.filter((c) => c.role === 'FINANCE').length
  if (primaryCount < 1) throw new Error('At least one PRIMARY contact is required.')
  if (financeCount > 1) throw new Error('Only one FINANCE contact is allowed.')

  const seenEmails = new Set<string>()
  for (const contact of contacts) {
    if (!contact.name) throw new Error('All contacts must have a name.')
    if (!contact.email) throw new Error('All contacts must have an email.')
    const normalizedEmail = normalizeEmail(contact.email)
    if (seenEmails.has(normalizedEmail)) {
      throw new Error('Contact emails must be unique per client.')
    }
    seenEmails.add(normalizedEmail)
  }
}

export async function createClientWithContacts(formData: FormData) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const name = String(formData.get('name') ?? '').trim()
  const paymentTermsDays = Number(formData.get('paymentTermsDays') ?? 30)
  const vatNumber = String(formData.get('vatNumber') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const contacts = parseContacts(String(formData.get('contactsJson') ?? '[]'))

  if (!name) throw new Error('Client name is required.')
  if (!Number.isFinite(paymentTermsDays) || paymentTermsDays <= 0) {
    throw new Error('Payment terms must be a positive number of days.')
  }
  validateContacts(contacts)

  const db = getSupabaseServiceRole()
  const { data: existingByName } = await db
    .from('Client')
    .select('id')
    .eq('agencyId', context.agencyId)
    .ilike('name', name)
    .maybeSingle()
  if (existingByName) {
    throw new Error('A client with this name already exists.')
  }

  // Atomic insert: Client + ClientContact rows committed in a single
  // transaction via create_client_with_contacts RPC. If any contact
  // insert fails (e.g. unique-constraint), the Client row rolls back
  // too — no orphan rows.
  const contactsPayload = contacts.map((contact) => ({
    name: contact.name,
    email: normalizeEmail(contact.email),
    role: contact.role,
    phone: contact.phone || null,
    notes: contact.notes || null,
  }))

  const { error: rpcErr } = await db.rpc('create_client_with_contacts', {
    p_agency_id: context.agencyId,
    p_name: name,
    p_payment_terms_days: Math.round(paymentTermsDays),
    p_vat_number: vatNumber || null,
    p_notes: notes || null,
    p_contacts: contactsPayload,
  })
  if (rpcErr) throw wrapPostgrestError(rpcErr)

  revalidatePath('/agency/clients')
  revalidatePath('/agency/pipeline')
  return { ok: true as const }
}

export async function updateClientWithContacts(formData: FormData) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })
  const clientId = String(formData.get('clientId') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const paymentTermsDays = Number(formData.get('paymentTermsDays') ?? 30)
  const vatNumber = String(formData.get('vatNumber') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()
  const contacts = parseContacts(String(formData.get('contactsJson') ?? '[]'))

  if (!clientId) throw new Error('Missing client id.')
  if (!name) throw new Error('Client name is required.')
  if (!Number.isFinite(paymentTermsDays) || paymentTermsDays <= 0) {
    throw new Error('Payment terms must be a positive number of days.')
  }
  validateContacts(contacts)

  const db = getSupabaseServiceRole()
  const { data: client } = await db
    .from('Client')
    .select('id')
    .eq('id', clientId)
    .eq('agencyId', context.agencyId)
    .maybeSingle()
  if (!client) {
    throw new Error('Client not found in your agency.')
  }

  const { data: duplicateByName } = await db
    .from('Client')
    .select('id')
    .eq('agencyId', context.agencyId)
    .neq('id', clientId)
    .ilike('name', name)
    .maybeSingle()
  if (duplicateByName) {
    throw new Error('Another client with this name already exists.')
  }

  // Atomic update: Client row + contact delete + contact insert are
  // committed in a single transaction via update_client_with_contacts.
  // If the re-insert fails, the old contact rows are restored by rollback
  // — no window where contacts are lost.
  const contactsPayload = contacts.map((contact) => ({
    name: contact.name,
    email: normalizeEmail(contact.email),
    role: contact.role,
    phone: contact.phone || null,
    notes: contact.notes || null,
  }))

  const { error: rpcErr } = await db.rpc('update_client_with_contacts', {
    p_agency_id: context.agencyId,
    p_client_id: clientId,
    p_name: name,
    p_payment_terms_days: Math.round(paymentTermsDays),
    p_vat_number: vatNumber || null,
    p_notes: notes || null,
    p_contacts: contactsPayload,
  })
  if (rpcErr) throw wrapPostgrestError(rpcErr)

  revalidatePath('/agency/clients')
  revalidatePath('/agency/pipeline')
  return { ok: true as const }
}
