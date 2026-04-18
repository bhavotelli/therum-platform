import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { THERUM_GATE_COOKIE } from '@/lib/auth/gate-token'

export async function POST() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()

  const res = NextResponse.json({ ok: true })
  res.cookies.set(THERUM_GATE_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
