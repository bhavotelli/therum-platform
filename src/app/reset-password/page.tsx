'use client'

import { Suspense } from 'react'

import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 text-amber-600 border-4 border-amber-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <PasswordResetForm />
    </Suspense>
  )
}
