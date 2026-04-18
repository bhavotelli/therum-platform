'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { switchSuperAdminTenant, clearSuperAdminTenantView } from '@/app/admin/actions'

type AgencyOption = { id: string; name: string; active: boolean }

const PORTALS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: '/admin', label: 'Admin', match: (p) => p === '/admin' || p.startsWith('/admin?') },
  { href: '/agency/pipeline', label: 'Agency', match: (p) => p.startsWith('/agency') },
  { href: '/finance/invoices', label: 'Finance', match: (p) => p.startsWith('/finance') },
]

export default function SuperAdminToolbarClient({
  agencies,
  currentAgencyId,
}: {
  agencies: AgencyOption[]
  currentAgencyId: string
}) {
  const pathname = usePathname() || '/'
  const pathOnly = pathname.split('?')[0] ?? '/'
  const hasTenant = Boolean(currentAgencyId)

  return (
    <div className="relative z-50 shrink-0 border-b border-amber-400/40 bg-gradient-to-r from-amber-950 via-[#1a1008] to-amber-950 px-4 py-2.5 text-amber-50">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/90">Super Admin</span>
          <nav className="flex flex-wrap items-center gap-1">
            {PORTALS.map((p) => {
              const active = p.match(pathOnly)
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-amber-500/25 text-white ring-1 ring-amber-400/50'
                      : 'text-amber-100/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {p.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <form action={switchSuperAdminTenant} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="redirectTo" value={pathOnly || '/agency/pipeline'} />
            <label htmlFor="super-admin-agency" className="sr-only">
              Viewing as agency
            </label>
            <select
              id="super-admin-agency"
              name="agencyId"
              defaultValue={currentAgencyId}
              className="max-w-[min(100vw-2rem,20rem)] rounded-lg border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              <option value="">Select agency…</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {!a.active ? ' (suspended)' : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400"
            >
              Apply
            </button>
          </form>

          {hasTenant ? (
            <form action={clearSuperAdminTenantView}>
              <input type="hidden" name="redirectTo" value="/admin" />
              <button
                type="submit"
                className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold text-amber-100/90 hover:bg-white/10"
              >
                Clear tenant
              </button>
            </form>
          ) : null}

          <p className="hidden text-[11px] text-amber-200/70 sm:block">
            {hasTenant ? 'Read-only tenant view' : 'Pick an agency to load agency & finance data'}
          </p>
        </div>
      </div>
    </div>
  )
}
