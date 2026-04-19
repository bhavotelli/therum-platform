'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getAgencySessionContext } from '@/lib/agencyAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function createTalent(formData: FormData) {
  const context = await getAgencySessionContext({ requireWriteAccess: true })

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const commissionRateRaw = String(formData.get('commissionRate') ?? '').trim()
  const vatRegistered = String(formData.get('vatRegistered') ?? '') === 'on'
  const vatNumber = String(formData.get('vatNumber') ?? '').trim()
  const portalEnabled = String(formData.get('portalEnabled') ?? '') === 'on'
  const businessType = String(formData.get('businessType') ?? 'SELF_EMPLOYED').trim()
  const companyName = String(formData.get('companyName') ?? '').trim()
  const companyRegNumber = String(formData.get('companyRegNumber') ?? '').trim()
  const registeredAddress = String(formData.get('registeredAddress') ?? '').trim()

  if (!name) throw new Error('Talent name is required')
  if (!email || !email.includes('@')) throw new Error('Valid talent email is required')
  if (vatRegistered && !vatNumber) throw new Error('VAT number is required when VAT registered is ticked')
  if (businessType === 'LTD_COMPANY') {
    if (!companyName) throw new Error('Company name is required for Limited Companies')
    if (!companyRegNumber) throw new Error('Company registration number is required for Limited Companies')
  }

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
      businessType: businessType === 'LTD_COMPANY' ? 'LTD_COMPANY' : 'SELF_EMPLOYED',
      companyName: businessType === 'LTD_COMPANY' ? companyName : null,
      companyRegNumber: businessType === 'LTD_COMPANY' ? companyRegNumber : null,
      registeredAddress: registeredAddress || null,
    })
    .select('id')
    .single()
  if (error) throw error

  revalidatePath('/agency/talent-roster')
  revalidatePath('/agency/pipeline/new')
  redirect(`/agency/talent-roster/${talent.id}?created=1`)
}
