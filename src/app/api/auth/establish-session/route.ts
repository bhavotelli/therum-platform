import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { mintGateToken, THERUM_GATE_COOKIE } from '@/lib/auth/gate-token'
import {
  resolveAppUserFromSupabaseAuth,
  describeAppUserLinkFailure,
} from '@/lib/auth/resolve-app-user'

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

  let appUser
  try {
    appUser = await resolveAppUserFromSupabaseAuth(user)
  } catch (err) {
    console.error('[establish-session] Prisma error while resolving user:', err)
    if (redirectTo !== null) {
      return NextResponse.redirect(
        new URL(
          '/login?notice=' +
            encodeURIComponent('Database error while signing in. Check DATABASE_URL matches your Supabase project.'),
          request.url,
        ),
      )
    }
    return NextResponse.json(
      {
        ok: false,
        error: 'DATABASE_ERROR',
        message:
          'Could not load your profile from the database. On Vercel, remove or update a stale DATABASE_URL so POSTGRES_PRISMA_URL (Supabase integration) is used, and ensure that database matches NEXT_PUBLIC_SUPABASE_URL.',
      },
      { status: 503 },
    )
  }

  if (!appUser) {
    let linkDetail: { code: string; message: string }
    try {
      linkDetail = await describeAppUserLinkFailure(user)
    } catch {
      linkDetail = {
        code: 'UNKNOWN',
        message: 'Could not verify your Therum account against the database.',
      }
    }
    const { code, message } = linkDetail
    const r =
      redirectTo !== null
        ? NextResponse.redirect(
            new URL(
              '/login?notice=' + encodeURIComponent(message),
              request.url,
            ),
          )
        : NextResponse.json(
            { ok: false, error: code, message },
            { status: 403 },
          )
    r.cookies.set(THERUM_GATE_COOKIE, '', { path: '/', maxAge: 0 })
    return r
  }

  let gate: string
  try {
    gate = await mintGateToken({
      sub: appUser.id,
      auth_sub: user.id,
      role: appUser.role,
    })
  } catch (err) {
    console.error('[establish-session] Gate token error:', err)
    if (redirectTo !== null) {
      return NextResponse.redirect(
        new URL(
          '/login?notice=' +
            encodeURIComponent(
              'Server missing AUTH_SECRET or NEXTAUTH_SECRET — add one in Vercel env and redeploy.',
            ),
          request.url,
        ),
      )
    }
    return NextResponse.json(
      {
        ok: false,
        error: 'GATE_SIGNING_FAILED',
        message:
          'Server could not sign the session cookie. Set AUTH_SECRET (or NEXTAUTH_SECRET) in Vercel and redeploy.',
      },
      { status: 500 },
    )
  }

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
