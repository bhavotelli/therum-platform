'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { buildSetPasswordLink, sendInviteEmail, sendPasswordResetEmail, verifyEmailTransport } from '@/lib/email';

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== UserRole.SUPER_ADMIN) {
    throw new Error('Unauthorized');
  }
  return (session.user as { id?: string }).id ?? null;
}

async function logAdminEvent(input: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata as any) ?? {},
      },
    });
  } catch {
    // Keep admin actions functional even if audit logging fails.
  }
}

function nameFromEmail(email: string) {
  const localPart = email.split('@')[0] ?? 'user';
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function adminRedirect(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  redirect(`/admin?${query.toString()}`);
}

function rethrowIfRedirectError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  ) {
    throw error;
  }
}

export async function createAgency(formData: FormData) {
  try {
    const adminId = await requireSuperAdmin();

    const name = String(formData.get('name') ?? '').trim();
    const primaryContactEmail = String(formData.get('primaryContactEmail') ?? '').trim().toLowerCase();
    const invoicingModel = String(formData.get('invoicingModel') ?? '');
    const vatRegistered = formData.get('vatRegistered') === 'on';

    if (!name || !primaryContactEmail) {
      throw new Error('Agency name and primary contact email are required.');
    }

    if (invoicingModel !== 'SELF_BILLING' && invoicingModel !== 'ON_BEHALF') {
      throw new Error('Invalid invoicing model.');
    }

    const existingUser = await prisma.user.findUnique({ where: { email: primaryContactEmail } });
    if (existingUser) {
      throw new Error('A user with that email already exists.');
    }

    const baseSlug = slugify(name);
    let slug = baseSlug || `agency-${Date.now()}`;
    let suffix = 1;
    while (await prisma.agency.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const inviteToken = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: {
          name,
          slug,
          invoicingModel,
          vatRegistered,
          commissionDefault: 20,
        },
      });

      await tx.user.create({
        data: {
          agencyId: agency.id,
          role: UserRole.AGENCY_ADMIN,
          active: true,
          email: primaryContactEmail,
          name: nameFromEmail(primaryContactEmail),
          inviteToken,
          inviteExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdBy: adminId,
        },
      });

      await logAdminEvent({
        actorUserId: adminId,
        action: 'ADMIN_CREATE_AGENCY',
        targetType: 'Agency',
        targetId: agency.id,
        metadata: { name, primaryContactEmail, invoicingModel, vatRegistered },
      });
    });

    revalidatePath('/admin');
    await sendInviteEmail(primaryContactEmail, buildSetPasswordLink('invite', inviteToken));
    adminRedirect({
      notice: `Created agency ${name}.`,
      actionLink: buildSetPasswordLink('invite', inviteToken),
      actionLabel: `Open invite link for ${primaryContactEmail}`,
    });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to create agency.';
    adminRedirect({ error: message });
  }
}

export async function addAgencyUser(formData: FormData) {
  try {
    const adminId = await requireSuperAdmin();

    const agencyId = String(formData.get('agencyId') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const role = String(formData.get('role') ?? '');

    if (!agencyId || !email) throw new Error('Agency and email are required.');
    if (!Object.values(UserRole).includes(role as UserRole) || role === UserRole.SUPER_ADMIN) {
      throw new Error('Invalid role selection.');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      // Re-invite flow for users already attached to the selected agency.
      if (existingUser.agencyId === agencyId && existingUser.role !== UserRole.SUPER_ADMIN) {
        const inviteToken = crypto.randomUUID();
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            role: role as UserRole,
            active: true,
            inviteToken,
            inviteExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
            createdBy: adminId,
          },
        });
        revalidatePath('/admin');
        await sendInviteEmail(email, buildSetPasswordLink('invite', inviteToken));
        await logAdminEvent({
          actorUserId: adminId,
          action: 'ADMIN_REINVITE_USER',
          targetType: 'User',
          targetId: existingUser.id,
          metadata: { email, agencyId, role },
        });
        adminRedirect({
          notice: `Re-invited ${email}.`,
          actionLink: buildSetPasswordLink('invite', inviteToken),
          actionLabel: `Open invite link for ${email}`,
        });
      }

      throw new Error('A user with that email already exists in another account.');
    }

    const inviteToken = crypto.randomUUID();
    await prisma.user.create({
      data: {
        agencyId,
        role: role as UserRole,
        active: true,
        email,
        name: nameFromEmail(email),
        inviteToken,
        inviteExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: adminId,
      },
    });

    revalidatePath('/admin');
    await sendInviteEmail(email, buildSetPasswordLink('invite', inviteToken));
    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_ADD_AGENCY_USER',
      targetType: 'User',
      targetId: null,
      metadata: { email, agencyId, role },
    });
    adminRedirect({
      notice: `Created invite for ${email}.`,
      actionLink: buildSetPasswordLink('invite', inviteToken),
      actionLabel: `Open invite link for ${email}`,
    });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to add user.';
    adminRedirect({ error: message });
  }
}

export async function updateUserRole(formData: FormData) {
  try {
    await requireSuperAdmin();

    const userId = String(formData.get('userId') ?? '');
    const role = String(formData.get('role') ?? '');

    if (!userId) throw new Error('Missing user id.');
    if (!Object.values(UserRole).includes(role as UserRole) || role === UserRole.SUPER_ADMIN) {
      throw new Error('Invalid role.');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
    });

    revalidatePath('/admin');
    await logAdminEvent({
      actorUserId: null,
      action: 'ADMIN_UPDATE_USER_ROLE',
      targetType: 'User',
      targetId: userId,
      metadata: { role },
    });
    adminRedirect({ notice: 'Updated user role.' });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to update role.';
    adminRedirect({ error: message });
  }
}

export async function resendInvite(formData: FormData) {
  try {
    await requireSuperAdmin();

    const userId = String(formData.get('userId') ?? '').trim();
    if (!userId) throw new Error('Missing user id.');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new Error('User not found.');
    if (user.role === UserRole.SUPER_ADMIN) throw new Error('Cannot resend invite for super admin.');

    const inviteToken = crypto.randomUUID();
    await prisma.user.update({
      where: { id: userId },
      data: {
        active: true,
        inviteToken,
        inviteExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    revalidatePath('/admin');
    await sendInviteEmail(user.email, buildSetPasswordLink('invite', inviteToken));
    await logAdminEvent({
      actorUserId: null,
      action: 'ADMIN_RESEND_INVITE',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
    });
    adminRedirect({
      notice: `Invite resent for ${user.email}.`,
      actionLink: buildSetPasswordLink('invite', inviteToken),
      actionLabel: `Open invite link for ${user.email}`,
    });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to resend invite.';
    adminRedirect({ error: message });
  }
}

export async function resetUserPassword(formData: FormData) {
  try {
    await requireSuperAdmin();

    const userId = String(formData.get('userId') ?? '').trim();
    if (!userId) throw new Error('Missing user id.');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new Error('User not found.');
    if (user.role === UserRole.SUPER_ADMIN) throw new Error('Use standard login recovery for super admin.');

    const token = crypto.randomUUID();
    await prisma.resetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    revalidatePath('/admin');
    await sendPasswordResetEmail(user.email, buildSetPasswordLink('reset', token));
    await logAdminEvent({
      actorUserId: null,
      action: 'ADMIN_RESET_PASSWORD',
      targetType: 'User',
      targetId: user.id,
      metadata: { email: user.email },
    });
    adminRedirect({
      notice: `Password reset generated for ${user.email}.`,
      actionLink: buildSetPasswordLink('reset', token),
      actionLabel: `Open reset link for ${user.email}`,
    });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to create password reset.';
    adminRedirect({ error: message });
  }
}

export async function toggleUserActive(formData: FormData) {
  try {
    await requireSuperAdmin();

    const userId = String(formData.get('userId') ?? '');
    const currentValue = String(formData.get('currentValue') ?? '');
    if (!userId) throw new Error('Missing user id.');

    await prisma.user.update({
      where: { id: userId },
      data: { active: currentValue !== 'true' },
    });

    revalidatePath('/admin');
    await logAdminEvent({
      actorUserId: null,
      action: currentValue === 'true' ? 'ADMIN_SUSPEND_USER' : 'ADMIN_REACTIVATE_USER',
      targetType: 'User',
      targetId: userId,
    });
    adminRedirect({ notice: currentValue === 'true' ? 'User suspended.' : 'User reactivated.' });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to update user status.';
    adminRedirect({ error: message });
  }
}

export async function toggleAgencyActive(formData: FormData) {
  try {
    await requireSuperAdmin();

    const agencyId = String(formData.get('agencyId') ?? '');
    const currentValue = String(formData.get('currentValue') ?? '');
    if (!agencyId) throw new Error('Missing agency id.');

    const nextActive = currentValue !== 'true';

    await prisma.$transaction(async (tx) => {
      await tx.agency.update({
        where: { id: agencyId },
        data: { active: nextActive },
      });

      // When agency is suspended, block all non-super-admin users in that agency.
      // On reactivation, restore access for users in that agency.
      await tx.user.updateMany({
        where: { agencyId, role: { not: UserRole.SUPER_ADMIN } },
        data: { active: nextActive },
      });
    });

    revalidatePath('/admin');
    await logAdminEvent({
      actorUserId: null,
      action: nextActive ? 'ADMIN_REACTIVATE_AGENCY' : 'ADMIN_SUSPEND_AGENCY',
      targetType: 'Agency',
      targetId: agencyId,
    });
    adminRedirect({ notice: nextActive ? 'Agency reactivated.' : 'Agency deactivated.' });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to update agency status.';
    adminRedirect({ error: message });
  }
}

export async function smtpHealthCheck() {
  try {
    const adminId = await requireSuperAdmin();
    await verifyEmailTransport();
    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_SMTP_HEALTHCHECK_OK',
      targetType: 'System',
      targetId: null,
    });
    adminRedirect({ notice: 'SMTP health check passed. Email transport is ready.' });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'SMTP health check failed.';
    await logAdminEvent({
      actorUserId: null,
      action: 'ADMIN_SMTP_HEALTHCHECK_FAIL',
      targetType: 'System',
      targetId: null,
      metadata: { message },
    });
    adminRedirect({ error: `SMTP check failed: ${message}` });
  }
}

export async function startImpersonationSession(formData: FormData) {
  try {
    const adminId = await requireSuperAdmin();
    const agencyId = String(formData.get('agencyId') ?? '').trim();
    if (!agencyId) throw new Error('Missing agency id.');

    const session = await prisma.impersonationSession.create({
      data: {
        adminUserId: adminId ?? '',
        agencyId,
      },
    });

    await logAdminEvent({
      actorUserId: adminId,
      action: 'ADMIN_START_IMPERSONATION',
      targetType: 'Agency',
      targetId: agencyId,
      metadata: { impersonationSessionId: session.id, mode: 'read_only' },
    });

    (await cookies()).set(
      'therum_impersonation',
      JSON.stringify({
        sessionId: session.id,
        agencyId,
        adminUserId: adminId ?? '',
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
    );

    adminRedirect({
      notice: 'Read-only impersonation session started. Agency writes are now blocked.',
    });
  } catch (error) {
    rethrowIfRedirectError(error);
    const message = error instanceof Error ? error.message : 'Failed to start impersonation session.';
    adminRedirect({ error: message });
  }
}
