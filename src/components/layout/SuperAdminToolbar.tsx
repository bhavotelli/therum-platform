import { cookies } from 'next/headers'

import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { parseImpersonationCookie } from '@/lib/impersonation'
import SuperAdminToolbarClient from '@/components/layout/SuperAdminToolbarClient'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { UserRoles } from '@/types/database'

export default async function SuperAdminToolbar() {
  const appUser = await resolveAppUser()
  const role = appUser?.role
  if (role !== UserRoles.SUPER_ADMIN) {
    return null
  }

  const db = getSupabaseServiceRole()
  const [impCookie, agenciesRes] = await Promise.all([
    (await cookies()).get('therum_impersonation')?.value,
    db.from('Agency').select('id, name, active').order('name', { ascending: true }),
  ])

  const agencies = agenciesRes.data ?? []
  if (agenciesRes.error) throw agenciesRes.error

  const currentAgencyId = parseImpersonationCookie(impCookie)?.agencyId ?? ''

  return <SuperAdminToolbarClient agencies={agencies} currentAgencyId={currentAgencyId} />
}
