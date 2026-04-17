import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';

type SetPasswordPageProps = {
  searchParams?: Promise<{ token?: string; type?: string; notice?: string; error?: string }>;
};

async function completeSetPassword(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const type = String(formData.get('type') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!token || (type !== 'invite' && type !== 'reset')) {
    redirect('/auth/set-password?error=Invalid link.');
  }
  if (!password || password.length < 6) {
    redirect(`/auth/set-password?type=${type}&token=${token}&error=Password must be at least 6 characters.`);
  }
  if (password !== confirmPassword) {
    redirect(`/auth/set-password?type=${type}&token=${token}&error=Passwords do not match.`);
  }

  if (type === 'invite') {
    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteExpiry: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!user) {
      redirect('/auth/set-password?error=Invite link is invalid or expired.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: password,
        active: true,
        inviteToken: null,
        inviteExpiry: null,
        lastLoginAt: new Date(),
      },
    });
  }

  if (type === 'reset') {
    const reset = await prisma.resetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!reset || reset.expiresAt <= new Date()) {
      redirect('/auth/set-password?error=Reset link is invalid or expired.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash: password,
          active: true,
          lastLoginAt: new Date(),
        },
      }),
      prisma.resetToken.delete({ where: { id: reset.id } }),
    ]);
  }

  redirect('/login?notice=Password set successfully. You can now sign in.');
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const token = params?.token ?? '';
  const type = params?.type ?? '';
  const notice = params?.notice;
  const error = params?.error;

  return (
    <div className="min-h-screen bg-[#0D1526] text-white p-6 font-sans flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 space-y-4">
        <h1 className="text-xl font-bold">Set Password</h1>
        <p className="text-sm text-zinc-400">
          {type === 'invite' ? 'Complete your invite setup.' : type === 'reset' ? 'Set a new password for your account.' : 'Use a valid password link.'}
        </p>

        {notice && <div className="rounded border border-emerald-300/30 bg-emerald-500/10 p-2 text-sm text-emerald-200">{notice}</div>}
        {error && <div className="rounded border border-red-300/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</div>}

        <form action={completeSetPassword} className="space-y-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="type" value={type} />
          <input
            name="password"
            type="password"
            placeholder="New password"
            required
            className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm"
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            required
            className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold">
            Save Password
          </button>
        </form>
      </div>
    </div>
  );
}
