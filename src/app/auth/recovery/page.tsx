import { redirect } from 'next/navigation'

type Props = {
  searchParams: Promise<{ next?: string }>
}

/** Legacy URL — Supabase may still allowlist `/auth/recovery`; redirects to canonical reset page. */
export default async function AuthRecoveryRedirect({ searchParams }: Props) {
  const sp = await searchParams
  const n = sp.next
  if (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//')) {
    redirect(`/reset-password?next=${encodeURIComponent(n)}`)
  }
  redirect('/reset-password')
}
