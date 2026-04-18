'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getAgencySessionContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function createTalent(formData: FormData) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()
  const commissionRateRaw = String(formData.get('commissionRate') ?? '').trim()
  const vatRegistered = String(formData.get('vatRegistered') ?? '') === 'on'
  const vatNumber = String(formData.get('vatNumber') ?? '').trim()
  const portalEnabled = String(formData.get('portalEnabled') ?? '') === 'on'

  if (!name) throw new Error('Talent name is required')
  if (!email || !email.includes('@')) throw new Error('Valid talent email is required')

  const commissionRate = Number(commissionRateRaw)
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    throw new Error('Commission rate must be between 0 and 100')
  }

  const db = getSupabaseServiceRole()
  const { data: existingByEmail } = await db
    .from('Talent')
    .select('id')
    .eq('agencyId', context.agencyId)
    .eq('email', email)
    .maybeSingle()
  if (existingByEmail) {
    throw new Error('A talent record with this email already exists')
  }

  const { data: existingByName } = await db
    .from('Talent')
    .select('id')
    .eq('agencyId', context.agencyId)
    .ilike('name', name)
    .maybeSingle()
  if (existingByName) {
    throw new Error('A talent record with this name already exists in this agency')
  }

  const { data: talent, error } = await db
    .from('Talent')
    .insert({
      agencyId: context.agencyId,
      name,
      email,
      commissionRate: String(commissionRate),
      vatRegistered,
      vatNumber: vatNumber || null,
      portalEnabled,
    })
    .select('id')
    .single()
  if (error) throw error

  revalidatePath('/agency/talent-roster')
  revalidatePath('/agency/pipeline/new')
  redirect(`/agency/talent-roster/${talent.id}?created=1`)
}
