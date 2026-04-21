'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { assertTargetUserIsNotSuperAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { insertAdminAuditLog } from '@/lib/db/admin-audit-log'
import { formatActionError, rethrowIfRedirectError } from '@/lib/errors'
import {
  getRecoveryRedirectForRole,
  getInviteRedirectForRole,
  inviteUserByGoTrue,
  sendMagicLinkStyleRecovery,
  sendPasswordRecoveryEmailViaGoTrue,
} from '@/lib/supabase/gotrue-mail'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { ensureSupabaseAuthUser } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import { UserRoles, type UserRole } from '@/types/database'

const ALL_ROLES = Object.values(UserRoles) as UserRole[]

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function logAdminEvent(input: {
  actorUserId?: string | null
  action: string
  targetType: string
  targetId?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    await insertAdminAuditLog({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? {}) as Json,
    })
  } catch {
    // Keep admin actions functional even if audit logging fails.
  }
}

function nameFromEmail(email: string) {
  const localPart = email.split('@')[0] ?? 'user'
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function adminRedirect(params: Record<string, string>) {
  const query = new URLSearchParams(params)
  redirect(`/admin?${query.toString()}`)
}

export async function createAgency(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const name = String(formData.get('name') ?? '').trim()
    const primaryContactEmail = String(formData.get('primaryContactEmail') ?? '').trim().toLowerCase()
    const invoicingModel = String(formData.get('invoicingModel') ?? '')
    const vatRegistered = formData.get('vatRegistered') === 'on'

    if (!name || !primaryContactEmail) {
      throw new Error('Agency name and primary contact email are required.')
    }

    if (invoicingModel !== 'SELF_BILLING' && invoicingModel !== 'ON_BEHALF') {
      throw new Error('Invalid invoicing model.')
    }

    const db = getSupabaseServiceRole()
    const { data: existingUser } = await db.from('User').select('id').eq('email', primaryContactEmail).maybeSingle()
    if (existingUser) {
      throw new Error('A user with that email already exists.')
    }

    const baseSlug = slugify(name)
    let slug = baseSlug || `agency-${Date.now()}`
    let suffix = 1
    while (true) {
      const { data: slugRow } = await db.from('Agency').select('id').eq('slug', slug).maybeSingle()
      if (!slugRow) break
      slug = `${baseSlug}-${suffix}`
      suffix += 1
    }

    const { data: agency, error: aErr } = await db
      .from('Agency')
      .insert({
        name,
        slug,
        invoicingModel,
        vatRegistered,
        commissionDefault: '20',
      })
      .select('id')
      .single()
    if (aErr) throw new Error(aErr.message)

    let authUserId: string
    try {
      authUserId = await inviteUserByGoTrue(
        primaryContactEmail,
        getInviteRedirectForRole(UserRoles.AGENCY_ADMIN),
      )
    } catch (inviteErr) {
      await db.from('Agency').delete().eq('id', agency.id)
      throw inviteErr
    }

    const { error: uErr } = await db.from('User').insert({
      agencyId: agency.id,
      authUserId,
      role: UserRoles.AGENCY_ADMIN,
      active: true,
      email: primaryContactEmail,
      name: nameFromEmail(primaryContactEmail),
      inviteToken: null,
      inviteExpiry: null,
      createdBy: adminId,
    })
    if (uErr) {
      await db.from('Agency').delete().eq('id', agency.id)
      throw new Error(uErr.message)
    }

    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_CREATE_AGENCY',
      targetType: 'Agency',
      targetId: agency.id,
      metadata: { name, primaryContactEmail, invoicingModel, vatRegistered },
    })

    revalidatePath('/admin')
    adminRedirect({
      notice: `Created agency ${name}. Invite email sent to ${primaryContactEmail} (Supabase Auth).`,
    })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to create agency.') })
  }
}

export async function addAgencyUser(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const agencyId = String(formData.get('agencyId') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const role = String(formData.get('role') ?? '')

    if (!agencyId || !email) throw new Error('Agency and email are required.')
    if (!ALL_ROLES.includes(role as UserRole) || role === UserRoles.SUPER_ADMIN) {
      throw new Error('Invalid role selection.')
    }

    const db = getSupabaseServiceRole()
    const { data: agencyRecord } = await db.from('Agency').select('id').eq('id', agencyId).maybeSingle()
    if (!agencyRecord) {
      throw new Error('Agency not found.')
    }

    const { data: existingUser } = await db.from('User').select('*').eq('email', email).maybeSingle()
    if (existingUser) {
      if (existingUser.agencyId === agencyId && existingUser.role !== UserRoles.SUPER_ADMIN) {
        let authId: string
        try {
          authId = await inviteUserByGoTrue(email, getInviteRedirectForRole(role))
        } catch {
          await sendMagicLinkStyleRecovery(email, getRecoveryRedirectForRole(role))
          authId = (existingUser.authUserId as string | null) ?? (await ensureSupabaseAuthUser(email))
        }
        const { error: upE } = await db
          .from('User')
          .update({
            role: role as UserRole,
            active: true,
            authUserId: authId,
            inviteToken: null,
            inviteExpiry: null,
            createdBy: adminId,
          })
          .eq('id', existingUser.id)
        if (upE) throw upE
        revalidatePath('/admin')
        await logAdminEvent({
          actorUserId: adminId,
          action: 'ADMIN_REINVITE_USER',
          targetType: 'User',
          targetId: existingUser.id,
          metadata: { email, agencyId, role },
        })
        adminRedirect({
          notice: `Email sent to ${email} (Supabase Auth invite or recovery).`,
        })
      }

      throw new Error('A user with that email already exists in another account.')
    }

    let authUserId: string
    try {
      authUserId = await inviteUserByGoTrue(email, getInviteRedirectForRole(role))
    } catch {
      authUserId = await ensureSupabaseAuthUser(email)
      await sendMagicLinkStyleRecovery(email, getRecoveryRedirectForRole(role))
    }

    const { error: crE } = await db.from('User').insert({
      agencyId,
      authUserId,
      role: role as UserRole,
      active: true,
      email,
      name: nameFromEmail(email),
      inviteToken: null,
      inviteExpiry: null,
      createdBy: adminId,
    })
    if (crE) throw crE

    revalidatePath('/admin')
    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_ADD_AGENCY_USER',
      targetType: 'User',
      targetId: null,
      metadata: { email, agencyId, role },
    })
    adminRedirect({
      notice: `Invite or recovery email sent to ${email} (Supabase Auth).`,
    })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to add user.') })
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const userId = String(formData.get('userId') ?? '')
    const role = String(formData.get('role') ?? '')

    if (!userId) throw new Error('Missing user id.')
    if (!ALL_ROLES.includes(role as UserRole) || role === UserRoles.SUPER_ADMIN) {
      throw new Error('Invalid role.')
    }

    await assertTargetUserIsNotSuperAdmin(userId)

    const db = getSupabaseServiceRole()
    const { error } = await db.from('User').update({ role: role as UserRole }).eq('id', userId)
    if (error) throw new Error(error.message)

    revalidatePath('/admin')
    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_UPDATE_USER_ROLE',
      targetType: 'User',
      targetId: userId,
      metadata: { role },
    })
    adminRedirect({ notice: 'Updated user role.' })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to update role.') })
  }
}

export async function resendInvite(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const userId = String(formData.get('userId') ?? '').trim()
    if (!userId) throw new Error('Missing user id.')

    const db = getSupabaseServiceRole()
    const { data: user } = await db
      .from('User')
      .select('id, email, role, authUserId')
      .eq('id', userId)
      .maybeSingle()
    if (!user) throw new Error('User not found.')
    if (user.role === UserRoles.SUPER_ADMIN) throw new Error('Cannot resend invite for super admin.')

    let authId: string
    try {
      authId = await inviteUserByGoTrue(user.email, getInviteRedirectForRole(user.role))
    } catch {
      await sendMagicLinkStyleRecovery(user.email, getRecoveryRedirectForRole(user.role))
      authId = user.authUserId ?? (await ensureSupabaseAuthUser(user.email))
    }

    const { error } = await db
      .from('User')
      .update({
        active: true,
        authUserId: authId,
        inviteToken: null,
        inviteExpiry: null,
      })
      .eq('id', userId)
    if (error) throw new Error(error.message)

    revalidatePath('/admin')
    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_RESEND_INVITE',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
    })
    adminRedirect({
      notice: `Email sent to ${user.email} (Supabase Auth invite or recovery).`,
    })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to resend invite.') })
  }
}

export async function resetUserPassword(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const userId = String(formData.get('userId') ?? '').trim()
    if (!userId) throw new Error('Missing user id.')

    const db = getSupabaseServiceRole()
    const { data: user } = await db.from('User').select('id, email, role').eq('id', userId).maybeSingle()
    if (!user) throw new Error('User not found.')
    if (user.role === UserRoles.SUPER_ADMIN) throw new Error('Use standard login recovery for super admin.')

    await sendPasswordRecoveryEmailViaGoTrue(user.email, getRecoveryRedirectForRole(user.role))

    revalidatePath('/admin')
    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_RESET_PASSWORD',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
    })
    adminRedirect({
      notice: `Password reset email sent to ${user.email} (Supabase Auth). Check their inbox.`,
    })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to create password reset.') })
  }
}

export async function toggleUserActive(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const userId = String(formData.get('userId') ?? '')
    const currentValue = String(formData.get('currentValue') ?? '')
    if (!userId) throw new Error('Missing user id.')

    await assertTargetUserIsNotSuperAdmin(userId)

    const db = getSupabaseServiceRole()
    const { error } = await db.from('User').update({ active: currentValue !== 'true' }).eq('id', userId)
    if (error) throw new Error(error.message)

    revalidatePath('/admin')
    await logAdminEvent({
      actorUserId: adminId,
      action: currentValue === 'true' ? 'ADMIN_SUSPEND_USER' : 'ADMIN_REACTIVATE_USER',
      targetType: 'User',
      targetId: userId,
    })
    adminRedirect({ notice: currentValue === 'true' ? 'User suspended.' : 'User reactivated.' })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to update user status.') })
  }
}

export async function toggleAgencyActive(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()

    const agencyId = String(formData.get('agencyId') ?? '')
    const currentValue = String(formData.get('currentValue') ?? '')
    if (!agencyId) throw new Error('Missing agency id.')

    const db = getSupabaseServiceRole()
    const { data: agencyRecord } = await db.from('Agency').select('id').eq('id', agencyId).maybeSingle()
    if (!agencyRecord) {
      throw new Error('Agency not found.')
    }

    const nextActive = currentValue !== 'true'

    const { error: e1 } = await db.from('Agency').update({ active: nextActive }).eq('id', agencyId)
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await db
      .from('User')
      .update({ active: nextActive })
      .eq('agencyId', agencyId)
      .neq('role', UserRoles.SUPER_ADMIN)
    if (e2) throw new Error(e2.message)

    revalidatePath('/admin')
    await logAdminEvent({
      actorUserId: adminId,
      action: nextActive ? 'ADMIN_REACTIVATE_AGENCY' : 'ADMIN_SUSPEND_AGENCY',
      targetType: 'Agency',
      targetId: agencyId,
    })
    adminRedirect({ notice: nextActive ? 'Agency reactivated.' : 'Agency deactivated.' })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to update agency status.') })
  }
}

export async function startImpersonationSession(formData: FormData) {
  try {
    const { userId: adminId } = await requireSuperAdmin()
    const agencyId = String(formData.get('agencyId') ?? '').trim()
    if (!agencyId) throw new Error('Missing agency id.')

    const db = getSupabaseServiceRole()
    const { data: agencyRecord } = await db.from('Agency').select('id').eq('id', agencyId).maybeSingle()
    if (!agencyRecord) {
      throw new Error('Agency not found.')
    }

    const sessionId = crypto.randomUUID()
    const { data: session, error: sErr } = await db
      .from('ImpersonationSession')
      .insert({ id: sessionId, adminUserId: adminId, agencyId })
      .select('id')
      .single()
    if (sErr) throw new Error(sErr.message)

    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_START_IMPERSONATION',
      targetType: 'Agency',
      targetId: agencyId,
      metadata: { impersonationSessionId: session.id, mode: 'read_only' },
    })

    ;(await cookies()).set(
      'therum_impersonation',
      JSON.stringify({
        sessionId: session.id,
        agencyId,
        adminUserId: adminId,
        readOnly: true,
        startedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 8,
      },
    )

    const redirectToRaw = String(formData.get('redirectTo') ?? '').trim()
    const redirectTo =
      redirectToRaw && redirectToRaw.startsWith('/') && !redirectToRaw.startsWith('//') ? redirectToRaw : null

    if (redirectTo) {
      redirect(redirectTo)
    }

    adminRedirect({
      notice: 'Read-only impersonation session started. Agency writes are now blocked.',
    })
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to start impersonation session.') })
  }
}

/** Super Admin toolbar — switch tenant without leaving the current portal (agency/finance). */
export async function switchSuperAdminTenant(formData: FormData) {
  const redirectToRaw = String(formData.get('redirectTo') ?? '/agency/pipeline').trim()
  const redirectTo =
    redirectToRaw && redirectToRaw.startsWith('/') && !redirectToRaw.startsWith('//') ? redirectToRaw : '/agency/pipeline'

  try {
    const { userId: adminId } = await requireSuperAdmin()
    const agencyId = String(formData.get('agencyId') ?? '').trim()
    if (!agencyId) throw new Error('Missing agency id.')

    const db = getSupabaseServiceRole()
    const { data: agencyRecord } = await db.from('Agency').select('id').eq('id', agencyId).maybeSingle()
    if (!agencyRecord) {
      throw new Error('Agency not found.')
    }

    const sessionId = crypto.randomUUID()
    const { data: session, error: sErr } = await db
      .from('ImpersonationSession')
      .insert({ id: sessionId, adminUserId: adminId, agencyId })
      .select('id')
      .single()
    if (sErr) throw new Error(sErr.message)

    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_SWITCH_TENANT',
      targetType: 'Agency',
      targetId: agencyId,
      metadata: { impersonationSessionId: session.id, mode: 'read_only' },
    })

    ;(await cookies()).set(
      'therum_impersonation',
      JSON.stringify({
        sessionId: session.id,
        agencyId,
        adminUserId: adminId,
        readOnly: true,
        startedAt: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 8,
      },
    )

    revalidatePath(redirectTo)
    redirect(redirectTo)
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to switch agency.'), returnTo: redirectTo })
  }
}

export async function clearSuperAdminTenantView(formData: FormData) {
  const redirectToRaw = String(formData.get('redirectTo') ?? '/admin').trim()
  const redirectTo =
    redirectToRaw && redirectToRaw.startsWith('/') && !redirectToRaw.startsWith('//') ? redirectToRaw : '/admin'

  try {
    await requireSuperAdmin()

    ;(await cookies()).delete('therum_impersonation')
    revalidatePath(redirectTo)
    redirect(redirectTo)
  } catch (error) {
    rethrowIfRedirectError(error)
    adminRedirect({ error: formatActionError(error, 'Failed to clear tenant view.'), returnTo: redirectTo })
  }
}
