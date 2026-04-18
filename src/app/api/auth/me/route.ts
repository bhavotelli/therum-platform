import { NextResponse } from 'next/server'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'

export async function GET() {
  const user = await resolveAppUser()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
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
  })
}
