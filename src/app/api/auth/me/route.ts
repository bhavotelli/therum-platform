import { NextResponse } from 'next/server'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const user = await resolveAppUser()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  // Pilot: same Agency row via user JWT + RLS (defense-in-depth path; see docs/compliance/supabase-rls-strategy.md).
  let agencyFromRls: { id: string; name: string; active: boolean } | null = null
  if (user.agencyId) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('Agency')
      .select('id, name, active')
      .eq('id', user.agencyId)
      .maybeSingle()
    if (!error && data) {
      agencyFromRls = {
        id: data.id as string,
        name: data.name as string,
        active: data.active as boolean,
      }
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      agencyId: user.agencyId,
      talentId: user.talentId,
    },
    agencyFromRls,
  })
}
