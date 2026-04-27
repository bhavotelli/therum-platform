'use client'

import { Suspense } from 'react'

import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 text-blue-600 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  )
}
