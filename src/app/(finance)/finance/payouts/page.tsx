import { redirect } from 'next/navigation'
import { getFinanceAgencyIdForUser } from '@/lib/financeAuth'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { buildTalentSummary, getPayoutQueue } from './data'
import { confirmPayoutRun } from './actions'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

export default async function PayoutsPage() {
  const appUser = await resolveAppUser()
  if (!appUser) {
    redirect('/login')
  }

  const userId = appUser.id
  const agencyId = await getFinanceAgencyIdForUser(userId)

  if (!agencyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900">Payout Centre</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-xs">
            Link this finance account to an agency to unlock payout exports.
          </p>
        </div>
      </div>
    )
  }

  const queue = await getPayoutQueue(agencyId)
  const paidMilestones = await prisma.milestone.findMany({
    where: {
      deal: { agencyId },
      payoutStatus: 'PAID',
      payoutDate: { not: null },
    },
    include: {
      deal: {
        include: {
          talent: true,
        },
      },
      invoiceTriplet: true,
    },
    orderBy: {
      payoutDate: 'desc',
    },
    take: 40,
  })
  const talentSummary = buildTalentSummary(queue)
  const totalGross = queue.reduce((sum, item) => sum + item.grossAmount, 0)
  const totalCommission = queue.reduce((sum, item) => sum + item.commissionAmount, 0)
  const totalNet = queue.reduce((sum, item) => sum + item.netPayoutAmount, 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Payout Centre</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Beta manual payout mode: export amounts due, then process transfers in your banking portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/finance/payouts/export.csv"
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Export CSV
          </a>
          <a
            href="/finance/payouts/export.xls"
            className="inline-flex items-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Export Excel
          </a>
          <form action={confirmPayoutRun}>
            <input type="hidden" name="milestoneIds" value={queue.map((item) => item.milestoneId).join(',')} />
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Confirm all as exported
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Ready Milestones</p>
          <p className="mt-1 text-2xl font-black text-zinc-900">{queue.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Talent in Run</p>
          <p className="mt-1 text-2xl font-black text-zinc-900">{talentSummary.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Gross</p>
          <p className="mt-1 text-xl font-black text-zinc-900">{formatCurrency(totalGross, 'GBP')}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Net Due</p>
          <p className="mt-1 text-xl font-black text-teal-700">{formatCurrency(totalNet, 'GBP')}</p>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No payouts ready.</p>
          <p className="text-zinc-500 text-sm max-w-xs">
            Milestones with payout status READY will appear here for manual payout export.
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Talent payout summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Talent</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-right font-semibold">Milestones</th>
                    <th className="px-4 py-3 text-right font-semibold">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold">Commission</th>
                    <th className="px-4 py-3 text-right font-semibold">Net Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {talentSummary.map((item) => (
                    <tr key={`${item.talentEmail}-${item.currency}`}>
                      <td className="px-4 py-3 font-semibold text-zinc-900">{item.talentName}</td>
                      <td className="px-4 py-3 text-zinc-600">{item.talentEmail}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{item.milestoneCount}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.totalGross, item.currency)}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.totalCommission, item.currency)}</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-700">{formatCurrency(item.totalNet, item.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Milestone payout queue</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Deal</th>
                    <th className="px-4 py-3 text-left font-semibold">Milestone</th>
                    <th className="px-4 py-3 text-left font-semibold">Talent</th>
                    <th className="px-4 py-3 text-right font-semibold">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold">Commission</th>
                    <th className="px-4 py-3 text-right font-semibold">Net Due</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {queue.map((item) => (
                    <tr key={item.milestoneId}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{item.dealTitle}</td>
                      <td className="px-4 py-3 text-zinc-700">{item.milestoneDescription}</td>
                      <td className="px-4 py-3 text-zinc-700">{item.talentName}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.grossAmount, item.currency)}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{formatCurrency(item.commissionAmount, item.currency)}</td>
                      <td className="px-4 py-3 text-right font-bold text-teal-700">{formatCurrency(item.netPayoutAmount, item.currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <form action={confirmPayoutRun}>
                          <input type="hidden" name="milestoneIds" value={item.milestoneId} />
                          <button
                            type="submit"
                            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Mark exported
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Payout history (exported)</h2>
        </div>
        {paidMilestones.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500">No exported payouts yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold">Payout date</th>
                  <th className="px-4 py-3 text-left font-semibold">Deal</th>
                  <th className="px-4 py-3 text-left font-semibold">Talent</th>
                  <th className="px-4 py-3 text-right font-semibold">Net paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {paidMilestones.map((row) => {
                  const ref = `PR-${new Date(row.payoutDate ?? row.updatedAt).toISOString().slice(0, 10).replace(/-/g, '')}-${row.id.slice(0, 6).toUpperCase()}`
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-zinc-800">{ref}</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {row.payoutDate ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.payoutDate)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{row.deal.title}</td>
                      <td className="px-4 py-3 text-zinc-700">{row.deal.talent.name}</td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                        {formatCurrency(Number(row.invoiceTriplet?.netPayoutAmount ?? row.grossAmount), row.deal.currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Beta note: Therum does not store talent bank account details. Exports provide payout amounts for manual transfer outside the platform.
      </div>
    </div>
  )
}
