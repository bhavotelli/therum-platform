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

  const { data: client, error: cErr } = await db
    .from('Client')
    .insert({
      agencyId: context.agencyId,
      name,
      paymentTermsDays: Math.round(paymentTermsDays),
      vatNumber: vatNumber || null,
      notes: notes || null,
    })
    .select('id')
    .single()
  if (cErr) throw wrapPostgrestError(cErr)

  const rows = contacts.map((contact) => ({
    agencyId: context.agencyId,
    clientId: client.id,
    name: contact.name,
    email: normalizeEmail(contact.email),
    role: contact.role,
    phone: contact.phone || null,
    notes: contact.notes || null,
  }))

  const { error: coErr } = await db.from('ClientContact').insert(rows)
  if (coErr) throw wrapPostgrestError(coErr)

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

  const { error: uErr } = await db
    .from('Client')
    .update({
      name,
      paymentTermsDays: Math.round(paymentTermsDays),
      vatNumber: vatNumber || null,
      notes: notes || null,
    })
    .eq('id', clientId)
  if (uErr) throw wrapPostgrestError(uErr)

  const { error: dErr } = await db.from('ClientContact').delete().eq('clientId', clientId).eq('agencyId', context.agencyId)
  if (dErr) throw wrapPostgrestError(dErr)

  const ins = contacts.map((contact) => ({
    agencyId: context.agencyId,
    clientId,
    name: contact.name,
    email: normalizeEmail(contact.email),
    role: contact.role,
    phone: contact.phone || null,
    notes: contact.notes || null,
  }))
  const { error: iErr } = await db.from('ClientContact').insert(ins)
  if (iErr) throw wrapPostgrestError(iErr)

  revalidatePath('/agency/clients')
  revalidatePath('/agency/pipeline')
  return { ok: true as const }
}
