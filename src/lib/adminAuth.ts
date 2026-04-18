import { redirect } from 'next/navigation'

import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { UserRole } from '@/types/database'
import { UserRoles } from '@/types/database'

/** Admin UI and server actions — only active SUPER_ADMIN sessions pass. */
export async function requireSuperAdmin(): Promise<{ userId: string }> {
  const appUser = await resolveAppUser()
  const userId = appUser?.id
  const role = appUser?.role

  if (!appUser || !userId) {
    redirect('/login')
  }
  if (role !== UserRoles.SUPER_ADMIN) {
    redirect('/login')
  }

  return { userId }
}

/** Blocks mutations on other super admin accounts (role escalation / lockout). */
export async function assertTargetUserIsNotSuperAdmin(userId: string) {
  const db = getSupabaseServiceRole()
  const { data: user, error } = await db.from('User').select('role').eq('id', userId).maybeSingle()
  if (error) throw error
  if (!user) {
    throw new Error('User not found.')
  }
  if ((user.role as UserRole) === UserRoles.SUPER_ADMIN) {
    throw new Error('This action cannot be performed on super admin accounts.')
  }
}
