import { redirect } from 'next/navigation'
import { getFinanceAgencyIdForUser } from '@/lib/financeAuth'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { buildTalentSummary, getPayoutQueue, getPendingAdjustments } from './data'
import { confirmPayoutRun } from './actions'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { DealNumberBadge } from '@/components/deals/DealNumberBadge'
import PayoutTalentAccordion from './PayoutTalentAccordion'

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

  const [queue, adjustments] = await Promise.all([
    getPayoutQueue(agencyId),
    getPendingAdjustments(agencyId),
  ])
  const db = getSupabaseServiceRole()
  const { data: dealRows } = await db.from('Deal').select('id').eq('agencyId', agencyId)
  const dealIds = (dealRows ?? []).map((d) => d.id as string)
  let paidMilestones: Array<{
    id: string
    payoutDate: string | null
    updatedAt: string
    grossAmount: unknown
    deal: { dealNumber: string | null; title: string; currency: string; talent: { name: string } }
    invoiceTriplet: { netPayoutAmount: unknown } | null
  }> = []
  if (dealIds.length > 0) {
    const { data: msRows } = await db
      .from('Milestone')
      .select('id, payoutDate, updatedAt, grossAmount, dealId, invoiceTripletId')
      .in('dealId', dealIds)
      .eq('payoutStatus', 'PAID')
      .not('payoutDate', 'is', null)
      .order('payoutDate', { ascending: false })
      .limit(40)
    const milestones = msRows ?? []
    const mDealIds = [...new Set(milestones.map((m) => m.dealId as string))]
    const { data: deals } = await db.from('Deal').select('id, dealNumber, title, currency, talentId').in('id', mDealIds)
    const dealMap = new Map((deals ?? []).map((d) => [d.id as string, d]))
    const uniqueTalentIds = [...new Set((deals ?? []).map((d) => d.talentId as string))]
    const { data: talents } = await db.from('Talent').select('id, name').in('id', uniqueTalentIds)
    const talentMap = new Map((talents ?? []).map((t) => [t.id as string, t.name as string]))
    const tripletIds = milestones.map((m) => m.invoiceTripletId).filter(Boolean) as string[]
    const { data: triplets } =
      tripletIds.length > 0
        ? await db.from('InvoiceTriplet').select('id, netPayoutAmount').in('id', tripletIds)
        : { data: [] }
    const tripMap = new Map((triplets ?? []).map((t) => [t.id as string, t]))
    paidMilestones = milestones.map((m) => {
      const deal = dealMap.get(m.dealId as string)!
      const tname = talentMap.get(deal.talentId as string) ?? '—'
      const inv = m.invoiceTripletId ? tripMap.get(m.invoiceTripletId as string) : undefined
      return {
        id: m.id as string,
        payoutDate: m.payoutDate as string | null,
        updatedAt: m.updatedAt as string,
        grossAmount: m.grossAmount,
        deal: {
          dealNumber: (deal.dealNumber as string | null) ?? null,
          title: deal.title as string,
          currency: deal.currency as string,
          talent: { name: tname },
        },
        invoiceTriplet: inv ? { netPayoutAmount: inv.netPayoutAmount } : null,
      }
    })
  }
  const talentSummary = buildTalentSummary(queue, adjustments)
  const totalGross = queue.reduce((sum, item) => sum + item.grossAmount, 0)
  const totalCommission = queue.reduce((sum, item) => sum + item.commissionAmount, 0)
  const totalNet = talentSummary.reduce((sum, t) => sum + t.adjustedNet, 0)

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
                      <td className="px-4 py-3 text-right font-bold text-teal-700">
                        {formatCurrency(item.adjustedNet, item.currency)}
                        {item.adjustments.length > 0 && (
                          <span className="ml-1.5 inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            {item.adjustments.length} adj
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <PayoutTalentAccordion queue={queue} summary={talentSummary} />
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
                      <td className="px-4 py-3 text-zinc-700">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DealNumberBadge dealNumber={row.deal.dealNumber} />
                          <span>{row.deal.title}</span>
                        </div>
                      </td>
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
