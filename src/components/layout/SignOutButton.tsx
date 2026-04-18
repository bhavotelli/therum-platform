'use client';

import { ReactNode, useState } from 'react';

type SignOutButtonProps = {
  className?: string;
  toastClassName?: string;
  callbackUrl?: string;
  toastMessage?: string;
  label?: string;
  signingOutLabel?: string;
  icon?: ReactNode;
};

export default function SignOutButton({
  className,
  toastClassName,
  callbackUrl = '/login',
  toastMessage = 'Signed out successfully. Redirecting to login...',
  label = 'Sign Out',
  signingOutLabel = 'Signing Out...',
  icon,
}: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
    } catch {
      /* still redirect */
    }
    window.location.href = callbackUrl;
  };

  return (
    <>
      {isSigningOut && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-lg backdrop-blur ${toastClassName ?? ''}`}
        >
          {toastMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className={`${className ?? ''} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {icon}
        {isSigningOut ? signingOutLabel : label}
      </button>
    </>
  );
}
