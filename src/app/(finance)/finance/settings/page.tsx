import { redirect } from 'next/navigation'

import { resolveFinancePageContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { disconnectXero } from './actions'
import { DealPrefixForm } from './DealPrefixForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const financeCtx = await resolveFinancePageContext()
  if (financeCtx.status === 'need_login') {
    redirect('/login')
  }
  if (financeCtx.status === 'need_impersonation') {
    redirect(
      '/admin?notice=' +
        encodeURIComponent('Choose an agency in the Super Admin bar to view finance for that tenant.'),
    )
  }
  if (financeCtx.status === 'need_agency') {
    return (
      <div className="p-8 text-center text-gray-500">
        No agency linked to this finance account. Ask an admin to assign your user to an agency.
      </div>
    )
  }

  const db = getSupabaseServiceRole()
  const { data: agency } = await db
    .from('Agency')
    .select(
      'id, name, planTier, invoicingModel, vatRegistered, vatNumber, commissionDefault, xeroTokens, xeroTenantId, dealNumberPrefix',
    )
    .eq('id', financeCtx.agencyId)
    .maybeSingle()

  if (!agency) {
    return (
      <div className="p-8 text-center text-gray-500">
        Agency not found. Your account may reference an agency that was removed.
      </div>
    )
  }

  const isXeroConnected = agency.xeroTokens !== null

  return (
    <div className="min-h-screen bg-[#f9fafb] p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Page Header */}
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Settings
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Manage your agency integrations and account preferences for{' '}
            <span className="text-gray-700 font-semibold">{agency.name}</span>.
          </p>
        </header>

        {/* Integrations Card */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Card top accent */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-indigo-500" />

          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              {/* Grid icon */}
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">Integrations</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Connect your accounting software and third-party services.</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 mb-6" />

            {/* Xero Integration Row */}
            <div className="flex items-center justify-between gap-6 p-5 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors">

              {/* Xero Brand */}
              <div className="flex items-center gap-4 min-w-0">
                {/* Xero Logo Placeholder — a clean "X" badge */}
                <div className="w-12 h-12 rounded-xl bg-[#13b5ea] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-white font-black text-xl leading-none tracking-tight">X</span>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 text-sm">Xero</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-relaxed max-w-xs">
                    Sync invoices bidirectionally with your Xero account. Approved invoice triplets are pushed automatically.
                  </div>
                  {isXeroConnected && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] text-emerald-600 font-semibold">
                        Tenant ID: <span className="font-mono text-emerald-700">{agency.xeroTenantId ?? '—'}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {isXeroConnected ? (
                  <>
                    {/* Connected Badge */}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold tracking-wide">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Connected to Xero
                    </span>

                    {/* Disconnect */}
                    <form action={disconnectXero}>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 border border-gray-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                      >
                        Disconnect
                      </button>
                    </form>
                  </>
                ) : (
                  <a
                    href="/api/xero/connect"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-150"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Connect to Xero
                  </a>
                )}
              </div>
            </div>

            {/* Future integrations placeholder */}
            <div className="mt-4 flex items-center justify-between gap-6 p-5 rounded-xl border border-dashed border-gray-200 bg-white opacity-50 cursor-not-allowed select-none">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#6772e5] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-base leading-none">S</span>
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">Stripe</div>
                  <div className="text-xs text-gray-500 mt-0.5">Automated talent payouts via Stripe Connect. <span className="font-semibold text-gray-400">(Coming soon)</span></div>
                </div>
              </div>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 text-xs font-bold tracking-wide border border-gray-200">
                Coming Soon
              </span>
            </div>

          </div>
        </section>

        {/* Agency Info Card */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">Agency Details</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Your agency's configuration and billing tier.</p>
              </div>
            </div>

            <div className="border-t border-gray-100 mb-6" />

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {[
                { label: 'Agency Name', value: agency.name },
                { label: 'Plan Tier', value: agency.planTier },
                { label: 'Invoicing Model', value: String(agency.invoicingModel).replace('_', ' ') },
                { label: 'VAT Registered', value: agency.vatRegistered ? 'Yes' : 'No' },
                { label: 'VAT Number', value: agency.vatNumber ?? '—' },
                { label: 'Default Commission', value: `${agency.commissionDefault}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1">{label}</dt>
                  <dd className="text-sm font-semibold text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Deal Numbering Card */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">Deal Numbering</h2>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  Set a unique prefix for your agency&apos;s deal references (e.g. <span className="font-mono">TH</span> → <span className="font-mono">TH-0001</span>). Flows through to Xero invoice references as <span className="font-mono">TH-0001-M01</span>.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 mb-6" />

            {agency.dealNumberPrefix ? (
              /* Prefix is set — display as locked (immutable once deals are numbered) */
              <div className="space-y-3">
                <div className="flex-1 max-w-xs">
                  <p className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Agency Prefix</p>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                    <span className="text-sm font-mono font-semibold text-gray-900">{agency.dealNumberPrefix}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">Locked</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-400">Prefix is permanent once deals have been numbered.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-indigo-700 font-medium">
                    Active prefix: <span className="font-mono font-bold">{agency.dealNumberPrefix}</span> — deals are numbered <span className="font-mono font-bold">{agency.dealNumberPrefix}-0001</span>, <span className="font-mono font-bold">{agency.dealNumberPrefix}-0002</span>, etc.
                  </span>
                </div>
              </div>
            ) : (
              /* No prefix yet — allow one-time configuration */
              <DealPrefixForm />
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
