import type { InvoicingModel } from '@/types/database'
import { loadFinanceInvoiceQueues } from '@/lib/finance/invoice-queue-data'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { amendApprovedObiTriplet, approveInvoiceTriplet, rejectInvoiceTriplet } from './actions'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DealNumberBadge } from '@/components/deals/DealNumberBadge'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import RecentlyApprovedInvoices from './RecentlyApprovedInvoices'

export const dynamic = 'force-dynamic'

type InvoiceContact = { id: string; email: string; name: string; role: string }

type InvoiceQueueTripletRow = {
  id: string
  invoicingModel: InvoicingModel
  milestoneId: string
  approvalStatus: string
  grossAmount: string | number
  netPayoutAmount: string | number
  commissionAmount: string | number
  invoiceDate: string
  invDueDateDays: number
  poNumber?: string | null
  invoiceNarrative?: string | null
  invNumber?: string | null
  obiNumber?: string | null
  comNumber?: string | null
  xeroObiId?: string | null
  invPaidAt?: string | null
  updatedAt?: string
  milestone: {
    status: string
    description: string
    deal: {
      id: string
      dealNumber: string | null
      title: string
      currency: string | null
      client: { id: string; name: string; contacts: InvoiceContact[] }
      talent: { name: string }
    }
  }
  manualCreditNotes?: { cnNumber?: string | null; amount?: string | number }[]
}

type AmendmentLogRow = {
  id: string
  targetId: string | null
  createdAt: string
  actorUser?: { name: string | null } | null
}

export default async function InvoiceQueuePage() {
  const financeCtx = await resolveFinancePageContext()
  if (financeCtx.status === 'need_login') redirect('/login')
  if (financeCtx.status === 'need_impersonation') {
    redirect('/admin?notice=' + encodeURIComponent('Choose an agency in the Super Admin bar to view finance for that tenant.'))
  }
  if (financeCtx.status === 'need_agency') {
    return <div className="p-8 text-center text-gray-500">No agency linked to this finance account.</div>
  }

  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('id, name, invoicingModel').eq('id', financeCtx.agencyId).maybeSingle()
  if (!agency) {
    return <div className="p-8 text-center text-gray-500">Agency not found.</div>
  }

  const { pendingTriplets, approvedObiTriplets, approvedTriplets, amendmentLogs } = (await loadFinanceInvoiceQueues(
    agency.id,
    agency.invoicingModel,
  )) as {
    pendingTriplets: InvoiceQueueTripletRow[]
    approvedObiTriplets: InvoiceQueueTripletRow[]
    approvedTriplets: InvoiceQueueTripletRow[]
    amendmentLogs: AmendmentLogRow[]
  }

  const latestAmendmentByTriplet = new Map<string, AmendmentLogRow>()
  for (const log of amendmentLogs) {
    if (!log.targetId || latestAmendmentByTriplet.has(log.targetId)) continue
    latestAmendmentByTriplet.set(log.targetId, log)
  }

  const fmt = (amount: unknown, currency?: string | null) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(Number(amount))

  const fmtDate = (date: string) =>
    new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))

  const fmtDue = (date: string, days: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d)
  }

  const docLabels = (model: InvoicingModel) =>
    model === 'SELF_BILLING' ? ['INV', 'SBI', 'COM'] : ['OBI', 'CN', 'COM']

  return (
    <div className="space-y-8">

      {/* Header */}
      <header className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Invoice Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve pending invoices for {agency.name}.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Pending</span>
          <span className="text-3xl font-black text-indigo-600 tabular-nums">{pendingTriplets.length}</span>
        </div>
      </header>

      {/* Pending queue */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-bold border-b border-gray-200">
              <tr>
                <th className="px-5 py-4">Talent → Client</th>
                <th className="px-5 py-4">Deal / Milestone</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4 text-right">Gross</th>
                <th className="px-5 py-4 text-right">Net</th>
                <th className="px-5 py-4 text-right">Com</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingTriplets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-gray-500 font-medium">Queue is clear</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingTriplets.map((triplet) => {
                  const deal = triplet.milestone.deal
                  const currency = deal.currency ?? 'GBP'
                  const labels = docLabels(triplet.invoicingModel)
                  const amendment = latestAmendmentByTriplet.get(triplet.id)
                  return (
                    <tr key={triplet.id} className="hover:bg-gray-50/40 transition-colors group align-top">

                      {/* Talent → Client */}
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{deal.talent.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{deal.client.name}</p>
                      </td>

                      {/* Deal / Milestone */}
                      <td className="px-5 py-4 max-w-[240px]">
                        {deal.dealNumber && (
                          <div className="mb-1">
                            <DealNumberBadge dealNumber={deal.dealNumber} />
                          </div>
                        )}
                        <Link
                          href={`/agency/pipeline/${deal.id}`}
                          className="font-semibold text-indigo-600 hover:underline truncate block"
                        >
                          {deal.title}
                        </Link>
                        <p className="text-xs text-gray-500 mt-0.5 truncate" title={triplet.milestone.description}>
                          {triplet.milestone.description}
                        </p>
                        {amendment && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            Edited {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(amendment.createdAt))}
                            {amendment.actorUser?.name ? ` · ${amendment.actorUser.name}` : ''}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-gray-900 font-medium">{fmtDate(triplet.invoiceDate)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Due {fmtDue(triplet.invoiceDate, triplet.invDueDateDays)}</p>
                      </td>

                      {/* Gross */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <p className="font-semibold text-gray-900">{fmt(triplet.grossAmount, currency)}</p>
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider">{labels[0]}</span>
                      </td>

                      {/* Net */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <p className="font-semibold text-indigo-600">{fmt(triplet.netPayoutAmount, currency)}</p>
                        <span className="text-[10px] font-bold text-indigo-400 tracking-wider">{labels[1]}</span>
                      </td>

                      {/* Commission */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <p className="font-semibold text-emerald-600">{fmt(triplet.commissionAmount, currency)}</p>
                        <span className="text-[10px] font-bold text-emerald-500 tracking-wider">{labels[2]}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-2">
                          {/* Approve form with contact picker */}
                          <form action={approveInvoiceTriplet} className="flex items-center gap-1.5">
                            <input type="hidden" name="tripletId" value={triplet.id} />
                            <select
                              name="recipientContactEmail"
                              defaultValue={
                                deal.client.contacts.find((c) => c.role === 'FINANCE')?.email ??
                                deal.client.contacts.find((c) => c.role === 'PRIMARY')?.email ??
                                deal.client.contacts[0]?.email ?? ''
                              }
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-700 max-w-[140px]"
                              title="Invoice recipient"
                            >
                              {deal.client.contacts.map((c) => (
                                <option key={`${triplet.id}-${c.id}`} value={c.email}>
                                  {c.name} ({c.role})
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-600 transition-all whitespace-nowrap"
                            >
                              Approve
                            </button>
                          </form>

                          <div className="flex items-center gap-1.5">
                            {/* Reject */}
                            <form action={rejectInvoiceTriplet.bind(null, triplet.id)}>
                              <button
                                type="submit"
                                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all whitespace-nowrap"
                              >
                                Reject
                              </button>
                            </form>

                            {/* Edit / View */}
                            <Link
                              href={`/finance/invoices/${triplet.id}`}
                              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors whitespace-nowrap"
                            >
                              Edit / View
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recently Approved */}
      <RecentlyApprovedInvoices
        rows={approvedTriplets.map((triplet) => ({
          id: triplet.id,
          invoiceRef: String(triplet.invNumber ?? triplet.obiNumber ?? triplet.comNumber ?? '—'),
          invoiceDate: fmtDate(triplet.invoiceDate),
          clientName: triplet.milestone.deal.client.name,
          talentName: triplet.milestone.deal.talent.name,
          grossAmount: Number(triplet.grossAmount),
          dealCurrency: triplet.milestone.deal.currency ?? 'GBP',
          invPaidAt: triplet.invPaidAt ? String(triplet.invPaidAt) : null,
        }))}
      />

      {/* OBI Amendment queue */}
      {agency.invoicingModel === 'ON_BEHALF' && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-amber-500" />
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">OBI Amendments (CN Flow)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Amend approved OBI invoices. Decreases only — each amendment raises one CN in Xero.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">OBI</th>
                  <th className="px-6 py-4">Client / Talent</th>
                  <th className="px-6 py-4 text-right">Current Gross</th>
                  <th className="px-6 py-4">CN Status</th>
                  <th className="px-6 py-4">Amend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvedObiTriplets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                      No approved OBI triplets available for amendment.
                    </td>
                  </tr>
                ) : (
                  approvedObiTriplets.map((triplet) => {
                    const cnList = triplet.manualCreditNotes ?? []
                    const latestCN = cnList[0]
                    return (
                      <tr key={`obi-${triplet.id}`} className="align-top hover:bg-gray-50/40 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{triplet.obiNumber ?? '—'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{triplet.milestone.description}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-800">{triplet.milestone.deal.client.name}</p>
                          <p className="text-xs text-gray-500">{triplet.milestone.deal.talent.name}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-semibold text-gray-900">
                            {fmt(triplet.grossAmount, triplet.milestone.deal.currency ?? 'GBP')}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {latestCN ? (
                            <div>
                              <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                CN Raised
                              </span>
                              <p className="text-xs text-gray-500 mt-1">
                                {latestCN.cnNumber ?? triplet.comNumber ?? 'CN'} ·{' '}
                                {fmt(Number(latestCN.amount), triplet.milestone.deal.currency ?? 'GBP')}
                              </p>
                              {cnList.length > 1 && (
                                <p className="text-[10px] text-gray-400">{cnList.length} CN cycles</p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              Pending CN
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <form action={amendApprovedObiTriplet} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="tripletId" value={triplet.id} />
                            <label className="text-[10px] text-gray-500 font-semibold">
                              New Gross
                              <input
                                name="grossAmount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={Math.max(0.01, Number(triplet.grossAmount) - 0.01).toFixed(2)}
                                defaultValue={Math.max(0.01, Number(triplet.grossAmount) - 1).toFixed(2)}
                                className="mt-1 block w-24 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold">
                              CN Date
                              <input
                                name="cnDate"
                                type="date"
                                defaultValue={new Date().toISOString().slice(0, 10)}
                                className="mt-1 block rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold">
                              Reason
                              <input
                                name="reason"
                                type="text"
                                required
                                maxLength={500}
                                placeholder="Amendment reason"
                                className="mt-1 block w-44 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <button
                              type="submit"
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                            >
                              Amend + Raise CN
                            </button>
                          </form>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
