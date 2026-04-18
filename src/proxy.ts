import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { verifyGateToken, THERUM_GATE_COOKIE } from '@/lib/auth/gate-token'

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: '/admin',
  AGENCY_ADMIN: '/agency/pipeline',
  AGENT: '/agency/dashboard',
  FINANCE: '/finance/invoices',
  TALENT: '/talent/dashboard',
}

const ADMIN_PATHS = ['/admin']
const AGENCY_PATHS = ['/agency']
const FINANCE_PATHS = ['/finance']
const TALENT_PATHS = ['/talent']

function portalFor(pathname: string): 'admin' | 'agency' | 'finance' | 'talent' | null {
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) return 'admin'
  if (AGENCY_PATHS.some((p) => pathname.startsWith(p))) return 'agency'
  if (FINANCE_PATHS.some((p) => pathname.startsWith(p))) return 'finance'
  if (TALENT_PATHS.some((p) => pathname.startsWith(p))) return 'talent'
  return null
}

function rolePortal(role: string): 'admin' | 'agency' | 'finance' | 'talent' | null {
  if (role === 'SUPER_ADMIN') return 'admin'
  if (role === 'AGENCY_ADMIN' || role === 'AGENT') return 'agency'
  if (role === 'FINANCE') return 'finance'
  if (role === 'TALENT') return 'talent'
  return null
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isTalentPreviewRoute = pathname.startsWith('/talent/preview/')
  const talentLoginDisabledForBeta = process.env.THERUM_BETA_PREVIEW_ONLY === 'true'

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/xero')

  if (isAuthRoute) {
    if (user && pathname.startsWith('/login')) {
      const gateRaw = request.cookies.get(THERUM_GATE_COOKIE)?.value
      let role: string | undefined
      if (gateRaw) {
        try {
          const gate = await verifyGateToken(gateRaw)
          if (gate.auth_sub === user.id) role = gate.role
        } catch {
          role = undefined
        }
      }
      if (role) {
        const home = ROLE_HOME[role] ?? '/login'
        return NextResponse.redirect(new URL(home, request.url))
      }
    }
    return response
  }

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const gateRaw = request.cookies.get(THERUM_GATE_COOKIE)?.value
  let role: string | undefined
  if (gateRaw) {
    try {
      const gate = await verifyGateToken(gateRaw)
      if (gate.auth_sub === user.id) {
        role = gate.role
      }
    } catch {
      role = undefined
    }
  }

  if (!role) {
    const next = pathname + request.nextUrl.search
    return NextResponse.redirect(
      new URL(`/api/auth/establish-session?next=${encodeURIComponent(next)}`, request.url),
    )
  }

  if (isTalentPreviewRoute) {
    const canPreviewTalent =
      role === 'SUPER_ADMIN' || role === 'AGENCY_ADMIN' || role === 'AGENT'
    if (!canPreviewTalent) {
      const home = ROLE_HOME[role] ?? '/login'
      return NextResponse.redirect(new URL(home, request.url))
    }
    return response
  }

  if (talentLoginDisabledForBeta && role === 'TALENT') {
    return NextResponse.redirect(
      new URL(
        '/login?notice=Talent+logins+are+disabled+in+beta.+Please+use+agency+preview+mode',
        request.url,
      ),
    )
  }

  const userPortal = rolePortal(role)
  const requestedPortal = portalFor(pathname)

  if (requestedPortal && userPortal && requestedPortal !== userPortal) {
    if (role !== 'SUPER_ADMIN') {
      const home = ROLE_HOME[role] ?? '/login'
      return NextResponse.redirect(new URL(home, request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
