import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'
import prisma from '@/lib/prisma'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'

/** Admin UI and server actions — only active SUPER_ADMIN sessions pass. */
export async function requireSuperAdmin(): Promise<{ userId: string }> {
  const appUser = await resolveAppUser()
  const userId = appUser?.id
  const role = appUser?.role

  if (!appUser || !userId) {
    redirect('/login')
  }
  if (role !== UserRole.SUPER_ADMIN) {
    redirect('/login')
  }

  return { userId }
}

/** Blocks mutations on other super admin accounts (role escalation / lockout). */
export async function assertTargetUserIsNotSuperAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user) {
    throw new Error('User not found.')
  }
  if (user.role === UserRole.SUPER_ADMIN) {
    throw new Error('This action cannot be performed on super admin accounts.')
  }
}
