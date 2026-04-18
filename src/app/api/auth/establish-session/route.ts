import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { mintGateToken, THERUM_GATE_COOKIE } from '@/lib/auth/gate-token'
import { resolveAppUserFromSupabaseAuth } from '@/lib/auth/resolve-app-user'

const COOKIE_OPTS = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8,
}

type SessionTokens = { access_token: string; refresh_token: string }

async function establish(
  request: NextRequest,
  redirectTo: string | null,
  sessionFromClient: SessionTokens | null,
) {
  const supabase = await createSupabaseServerClient()

  // Prefer explicit tokens from the client right after signInWithPassword — cookie chunks
  // may not be visible to this request yet, which previously caused 401 + "Could not complete sign-in".
  if (sessionFromClient) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: sessionFromClient.access_token,
      refresh_token: sessionFromClient.refresh_token,
    })
    if (setErr) {
      if (redirectTo !== null) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      return NextResponse.json(
        { ok: false, error: 'Invalid or expired session' },
        { status: 401 },
      )
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (redirectTo !== null) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
  }

  const appUser = await resolveAppUserFromSupabaseAuth(user)
  if (!appUser) {
    const r =
      redirectTo !== null
        ? NextResponse.redirect(
            new URL(
              '/login?notice=' + encodeURIComponent('Your account is not linked to Therum yet.'),
              request.url,
            ),
          )
        : NextResponse.json({ ok: false, error: 'Not linked' }, { status: 403 })
    r.cookies.set(THERUM_GATE_COOKIE, '', { path: '/', maxAge: 0 })
    return r
  }

  const gate = await mintGateToken({
    sub: appUser.id,
    auth_sub: user.id,
    role: appUser.role,
  })

  if (redirectTo !== null) {
    const safe =
      redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/'
    const res = NextResponse.redirect(new URL(safe, request.url))
    res.cookies.set(THERUM_GATE_COOKIE, gate, COOKIE_OPTS)
    return res
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(THERUM_GATE_COOKIE, gate, COOKIE_OPTS)
  return res
}

/** Middleware self-heal: `GET ?next=/path` */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get('next')
  return establish(request, next, null)
}

/** After browser sign-in: `POST` optionally `{ next, access_token, refresh_token }` */
export async function POST(request: NextRequest) {
  let next: string | null = null
  let sessionFromClient: SessionTokens | null = null
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body?.next === 'string') next = body.next
    if (
      typeof body?.access_token === 'string' &&
      typeof body?.refresh_token === 'string' &&
      body.access_token.length > 0 &&
      body.refresh_token.length > 0
    ) {
      sessionFromClient = {
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      }
    }
  } catch {
    next = null
    sessionFromClient = null
  }
  return establish(request, next, sessionFromClient)
}
