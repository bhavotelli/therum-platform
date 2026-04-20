import { notFound, redirect } from 'next/navigation'
import { resolveAgencyPageContext } from '@/lib/agencyAuth'
import { getVatMonitoringForAgency, VAT_THRESHOLD, VAT_AMBER_START, VAT_RED_START } from '@/lib/vat-monitoring'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

export default async function VatMonitorPage() {
  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_login') redirect('/login')
  if (agencyCtx.status === 'forbidden' || agencyCtx.status === 'need_impersonation') notFound()
  if (agencyCtx.status === 'no_agency') {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">No agency linked to this user yet.</div>
    )
  }

  const statuses = await getVatMonitoringForAgency(agencyCtx.agencyId)

  const atRed = statuses.filter((s) => s.band === 'red')
  const atAmber = statuses.filter((s) => s.band === 'amber')
  const atGreen = statuses.filter((s) => s.band === 'green')

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">VAT Threshold Monitor</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Rolling 12-month earnings for non-VAT-registered talent. UK threshold: {formatCurrency(VAT_THRESHOLD)}.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Register ASAP (&gt;£{VAT_RED_START / 1000}k)</p>
          <p className="text-3xl font-black text-rose-700 mt-2">{atRed.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Speak to accountant (&gt;£{VAT_AMBER_START / 1000}k)</p>
          <p className="text-3xl font-black text-amber-700 mt-2">{atAmber.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Within threshold</p>
          <p className="text-3xl font-black text-emerald-700 mt-2">{atGreen.length}</p>
        </div>
      </div>

      {statuses.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No unregistered talent found.</p>
          <p className="text-zinc-500 text-sm max-w-sm">All talent on your roster either have a VAT number set or are marked as VAT registered.</p>
        </div>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Talent</th>
                  <th className="px-5 py-3 text-right font-semibold">12-month earnings</th>
                  <th className="px-5 py-3 text-right font-semibold">% of threshold</th>
                  <th className="px-5 py-3 text-right font-semibold">Remaining to £90k</th>
                  <th className="px-5 py-3 text-left font-semibold w-48">Progress</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {statuses.map((status) => {
                  const barColor =
                    status.band === 'red' ? 'bg-rose-500' : status.band === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
                  const badgeColor =
                    status.band === 'red'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : status.band === 'amber'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  const badgeLabel =
                    status.band === 'red' ? 'Register ASAP' : status.band === 'amber' ? 'Speak to accountant' : 'Healthy'

                  return (
                    <tr key={status.talentId} className={status.band === 'red' ? 'bg-rose-50/30' : status.band === 'amber' ? 'bg-amber-50/30' : ''}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-zinc-900">{status.talentName}</p>
                        <p className="text-xs text-zinc-500">{status.talentEmail}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-zinc-900">{formatCurrency(status.rolling12mTotal)}</td>
                      <td className="px-5 py-3 text-right text-zinc-700">{status.pctOfThreshold}%</td>
                      <td className="px-5 py-3 text-right text-zinc-700">{formatCurrency(status.remainingToThreshold)}</td>
                      <td className="px-5 py-3">
                        <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${status.pctOfThreshold}%` }} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 space-y-1">
        <p><span className="font-semibold">Green</span> — Under £{VAT_AMBER_START.toLocaleString()}: no action needed.</p>
        <p><span className="font-semibold">Amber</span> — £{VAT_AMBER_START.toLocaleString()}–£{VAT_RED_START.toLocaleString()}: speak to talent and accountant about VAT registration.</p>
        <p><span className="font-semibold">Red</span> — Over £{VAT_RED_START.toLocaleString()}: approaching the £{VAT_THRESHOLD.toLocaleString()} threshold — register ASAP.</p>
        <p className="text-zinc-400 pt-1">Earnings = net payout amounts from approved/paid invoices within the rolling 12-month window. Only talent with no VAT number and not marked as VAT registered are shown.</p>
      </div>
    </div>
  )
}
