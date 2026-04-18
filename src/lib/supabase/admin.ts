import { createClient, type User as SupabaseAuthUser } from '@supabase/supabase-js'

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRole) {
    throw new Error('Supabase admin client is not configured.')
  }
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function findAuthUserByEmail(email: string): Promise<SupabaseAuthUser | null> {
  const supabase = getSupabaseAdminClient()
  const normalized = email.trim().toLowerCase()
  let page = 1

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Supabase list users failed: ${error.message}`)
    const users = data.users ?? []
    const match = users.find((u) => (u.email ?? '').trim().toLowerCase() === normalized) ?? null
    if (match) return match
    if (users.length < 1000) return null
    page += 1
  }
}

/**
 * Ensure a Supabase auth user exists for an app email, returning auth.users.id.
 */
export async function ensureSupabaseAuthUser(email: string): Promise<string> {
  const existing = await findAuthUserByEmail(email)
  if (existing?.id) return existing.id

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (error) {
    // If another process created it concurrently, resolve by email one more time.
    const recovered = await findAuthUserByEmail(email)
    if (recovered?.id) return recovered.id
    throw new Error(`Failed to provision Supabase auth user: ${error.message}`)
  }
  if (!data.user?.id) {
    throw new Error('Supabase did not return created auth user id.')
  }
  return data.user.id
}

export async function setSupabaseAuthPasswordById(authUserId: string, password: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    password,
    email_confirm: true,
  })
  if (error) throw new Error(`Failed to update Supabase password: ${error.message}`)
}
