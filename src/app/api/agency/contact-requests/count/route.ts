import { NextResponse } from 'next/server'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

// THE-84: small read-only endpoint for the agency sidebar badge. Counts OPEN
// ContactRequest rows in the current user's agency. Returns 0 for users
// without an agency or without an agency-staff role.
export async function GET() {
  const user = await resolveAppUser()
  if (!user || !user.agencyId) {
    return NextResponse.json({ count: 0 })
  }
  if (user.role !== 'AGENCY_ADMIN' && user.role !== 'AGENT' && user.role !== 'FINANCE') {
    return NextResponse.json({ count: 0 })
  }

  const db = getSupabaseServiceRole()
  const { count } = await db
    .from('ContactRequest')
    .select('id', { count: 'exact', head: true })
    .eq('agencyId', user.agencyId)
    .eq('status', 'OPEN')

  return NextResponse.json({ count: count ?? 0 })
}
