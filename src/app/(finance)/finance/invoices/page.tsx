import type { InvoicingModel } from '@/types/database'
import { loadFinanceInvoiceQueues } from '@/lib/finance/invoice-queue-data'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { amendApprovedObiTriplet, amendInvoiceDraft, approveInvoiceTriplet, rejectInvoiceTriplet } from './actions'
import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
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
  invoiceAddress?: string | null
  invNumber?: string | null
  obiNumber?: string | null
  comNumber?: string | null
  cnNumber?: string | null
  xeroObiId?: string | null
  recipientContactName?: string | null
  recipientContactEmail?: string | null
  invPaidAt?: string | null
  updatedAt?: string
  milestone: {
    status: string
    description: string
    deal: {
      id: string
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
  const { data: agency } = await db.from('Agency').select('id, name, invoicingModel').eq('id', financeCtx.agencyId).maybeSingle()

  if (!agency) {
    return (
      <div className="p-8 text-center text-gray-500">
        Agency not found. Your account may reference an agency that was removed.
      </div>
    )
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

  const latestAmendmentByTriplet = new Map<string, (typeof amendmentLogs)[number]>()
  for (const log of amendmentLogs) {
    if (!log.targetId || latestAmendmentByTriplet.has(log.targetId)) continue
    latestAmendmentByTriplet.set(log.targetId, log)
  }

  // Format amount based on currency
  const formatCurrency = (amount: unknown, currency?: string | null) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(Number(amount))
  }
  const formatDueDate = (invoiceDate: Date, dueDays: number) => {
    const dueDate = new Date(invoiceDate)
    dueDate.setDate(dueDate.getDate() + dueDays)
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(dueDate)
  }

  // Get dynamic column labels based on the invoicing model
  const getDocLabels = (model: InvoicingModel) => {
    if (model === 'SELF_BILLING') {
      return ['INV', 'SBI', 'COM']
    } else {
      return ['OBI', 'CN', 'COM']
    }
  }

  const getMilestoneStatusPill = (status: string) => {
    if (status === 'PAID' || status === 'PAYOUT_READY') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'INVOICED') return 'bg-blue-50 text-blue-700 border-blue-200'
    if (status === 'COMPLETE') return 'bg-purple-50 text-purple-700 border-purple-200'
    if (status === 'CANCELLED') return 'bg-rose-50 text-rose-700 border-rose-200'
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] selection:bg-indigo-500/30 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-2xl bg-white border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 opacity-10 bg-indigo-500 blur-3xl rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          
          <div className="relative z-10 w-full">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
              Invoice Verification Queue
            </h1>
            <p className="text-gray-500 font-medium">
              Review and approve pending invoice triplets for {agency.name}.
            </p>
          </div>
          
          <div className="relative z-10 flex flex-col items-end min-w-[120px]">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Queue Size</div>
            <div className="text-4xl font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
              {pendingTriplets.length}
            </div>
          </div>
        </header>

        {/* Data Table Container */}
        <main className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
          {/* Subtle gradient border accent at the top */}
          <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-bold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Talent</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Deal</th>
                  <th className="px-6 py-4">Milestone Status</th>
                  <th className="px-6 py-4">Invoice Date</th>
                  <th className="px-6 py-4 text-right">Gross</th>
                  <th className="px-6 py-4 text-right">Net Payout</th>
                  <th className="px-6 py-4 text-right">Commission</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingTriplets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 font-medium">The queue is currently empty.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pendingTriplets.map(triplet => {
                    const deal = triplet.milestone.deal
                    const dealCurrency = deal.currency ?? 'GBP'
                    const labels = getDocLabels(triplet.invoicingModel)
                    
                    return (
                      <tr key={triplet.id} className="hover:bg-gray-50/50 transition-colors group">
                        
                        <td className="px-6 py-5 align-top">
                          <div className="font-semibold text-gray-900">{deal.talent.name}</div>
                        </td>
                        
                        <td className="px-6 py-5 align-top">
                          <div className="font-medium text-gray-600">{deal.client.name}</div>
                        </td>
                        
                        <td className="px-6 py-5 align-top max-w-[260px]">
                          <Link href={`/agency/pipeline/${deal.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold mb-1 block truncate">
                            {deal.title}
                          </Link>
                          <div className="text-xs text-gray-500 truncate" title={triplet.milestone.description}>
                            {triplet.milestone.description}
                          </div>
                          <form action={amendInvoiceDraft} className="mt-3 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="tripletId" value={triplet.id} />
                            <label className="text-[10px] text-gray-500 font-semibold">
                              Invoice Date
                              <input
                                name="invoiceDate"
                                type="date"
                                defaultValue={new Date(triplet.invoiceDate).toISOString().slice(0, 10)}
                                className="mt-1 block rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold">
                              Due in (days)
                              <input
                                name="invDueDateDays"
                                type="number"
                                min="0"
                                max="365"
                                step="1"
                                defaultValue={triplet.invDueDateDays}
                                className="mt-1 block w-24 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold">
                              Gross
                              <input
                                name="grossAmount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                defaultValue={Number(triplet.grossAmount).toFixed(2)}
                                className="mt-1 block w-28 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold">
                              PO Number
                              <input
                                name="poNumber"
                                type="text"
                                defaultValue={triplet.poNumber ?? ''}
                                className="mt-1 block w-28 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold min-w-[220px]">
                              Narrative
                              <input
                                name="invoiceNarrative"
                                type="text"
                                defaultValue={triplet.invoiceNarrative ?? ''}
                                className="mt-1 block w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                              />
                            </label>
                            <label className="text-[10px] text-gray-500 font-semibold min-w-[220px]">
                              Invoice Address
                              <textarea
                                name="invoiceAddress"
                                defaultValue={triplet.invoiceAddress ?? ''}
                                className="mt-1 block w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                                rows={2}
                              />
                            </label>
                            <button
                              type="submit"
                              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Save Draft
                            </button>
                          </form>
                          <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-600">
                            <p className="font-semibold text-zinc-700">Invoice Body Preview</p>
                            <p>Recipient: {deal.client.contacts.find((c) => c.role === 'FINANCE')?.name ?? deal.client.contacts[0]?.name ?? '—'}</p>
                            <p>Address: {triplet.invoiceAddress ?? 'Use client default address in Xero contact'}</p>
                            <p>PO: {triplet.poNumber ?? '—'}</p>
                            <p>Narrative: {triplet.invoiceNarrative ?? triplet.milestone.description}</p>
                          </div>
                          {latestAmendmentByTriplet.get(triplet.id) && (
                            <p className="mt-2 text-[11px] text-gray-500">
                              Last amended{' '}
                              {new Intl.DateTimeFormat('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              }).format(new Date(latestAmendmentByTriplet.get(triplet.id)!.createdAt))}
                              {' · '}
                              by {latestAmendmentByTriplet.get(triplet.id)!.actorUser?.name ?? 'System'}
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-5 align-top">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getMilestoneStatusPill(triplet.milestone.status)}`}
                          >
                            {triplet.milestone.status}
                          </span>
                        </td>

                        <td className="px-6 py-5 align-top text-sm text-gray-600 whitespace-nowrap">
                          {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(triplet.invoiceDate))}
                          <div className="text-xs text-gray-500 mt-1">
                            Due {formatDueDate(new Date(triplet.invoiceDate), triplet.invDueDateDays)}
                          </div>
                        </td>
                        
                        {/* GROSS */}
                        <td className="px-6 py-5 align-top text-right">
                          <div className="font-semibold text-gray-900 group-hover:text-indigo-900 transition-colors">
                            {formatCurrency(triplet.grossAmount, dealCurrency)}
                          </div>
                          <div className="inline-block mt-1.5 px-2 py-0.5 bg-gray-100 text-[10px] text-gray-500 font-bold tracking-widest rounded shadow-sm border border-gray-200">
                            {labels[0]}
                          </div>
                        </td>
                        
                        {/* NET PAYOUT */}
                        <td className="px-6 py-5 align-top text-right">
                          <div className="font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                            {formatCurrency(triplet.netPayoutAmount, dealCurrency)}
                          </div>
                          <div className="inline-block mt-1.5 px-2 py-0.5 bg-indigo-50 text-[10px] text-indigo-500 font-bold tracking-widest rounded shadow-sm border border-indigo-100">
                            {labels[1]}
                          </div>
                        </td>
                        
                        {/* COMMISSION */}
                        <td className="px-6 py-5 align-top text-right">
                          <div className="font-semibold text-emerald-600 group-hover:text-emerald-700 transition-colors">
                            {formatCurrency(triplet.commissionAmount, dealCurrency)}
                          </div>
                          <div className="inline-block mt-1.5 px-2 py-0.5 bg-emerald-50 text-[10px] text-emerald-600 font-bold tracking-widest rounded shadow-sm border border-emerald-100">
                            {labels[2]}
                          </div>
                        </td>
                        
                        {/* ACTIONS */}
                        <td className="px-6 py-5 align-middle">
                          <div className="flex items-center justify-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                            <form action={approveInvoiceTriplet} className="flex items-center gap-2">
                              <input type="hidden" name="tripletId" value={triplet.id} />
                              <select
                                name="recipientContactEmail"
                                defaultValue={
                                  deal.client.contacts.find((c) => c.role === 'FINANCE')?.email ??
                                  deal.client.contacts.find((c) => c.role === 'PRIMARY')?.email ??
                                  deal.client.contacts[0]?.email ??
                                  ''
                                }
                                className="max-w-[160px] rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-700"
                                title="Invoice recipient"
                              >
                                {deal.client.contacts.map((contact) => (
                                  <option key={`${triplet.id}-${contact.id}`} value={contact.email}>
                                    {contact.name} ({contact.role})
                                  </option>
                                ))}
                              </select>
                              <button 
                                type="submit" 
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold shadow-sm hover:bg-emerald-500 hover:text-white hover:border-emerald-600 transition-all shrink-0"
                              >
                                Approve
                              </button>
                            </form>
                            <form action={rejectInvoiceTriplet.bind(null, triplet.id)}>
                              <button 
                                type="submit"
                                className="px-3 py-1.5 bg-white text-rose-600 border border-gray-200 rounded-md text-xs font-semibold shadow-sm hover:bg-rose-50 hover:border-rose-200 transition-all shrink-0"
                              >
                                Reject
                              </button>
                            </form>
                          </div>
                        </td>
                        
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>

        <RecentlyApprovedInvoices
          rows={approvedTriplets.map((triplet) => {
            const deal = triplet.milestone.deal
            const invPaidAt = triplet.invPaidAt ? new Date(triplet.invPaidAt as string | number).toISOString() : null
            return {
              id: triplet.id,
              invoiceRef: String(triplet.invNumber ?? triplet.obiNumber ?? triplet.comNumber ?? '—'),
              invoiceDate: new Date(triplet.invoiceDate).toISOString().slice(0, 10),
              clientName: deal.client.name,
              talentName: deal.talent.name,
              dealId: deal.id,
              dealCurrency: deal.currency ?? 'GBP',
              grossAmount: Number(triplet.grossAmount),
              invPaidAt,
              poNumber: triplet.poNumber ?? null,
              invoiceNarrative: triplet.invoiceNarrative ?? triplet.milestone.description,
              invoiceAddress: triplet.invoiceAddress ?? null,
              recipientContactName: triplet.recipientContactName ?? null,
              recipientContactEmail: triplet.recipientContactEmail ?? null,
            }
          })}
        />

        {agency.invoicingModel === 'ON_BEHALF' ? (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-rose-500 to-amber-500" />
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold tracking-tight text-gray-900">Approved OBI Amendments (CN Flow)</h2>
              <p className="text-sm text-gray-500 mt-1">
                Use this queue to amend approved OBI invoices. Decreases only; each amendment raises one CN and pushes to Xero.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Triplet</th>
                    <th className="px-6 py-4">Client / Talent</th>
                    <th className="px-6 py-4 text-right">Current Gross</th>
                    <th className="px-6 py-4">CN Status</th>
                    <th className="px-6 py-4">Amend + Raise CN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {approvedObiTriplets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                        No approved OBI triplets currently available for CN amendment.
                      </td>
                    </tr>
                  ) : (
                    approvedObiTriplets.map((triplet) => {
                      const cnList = triplet.manualCreditNotes ?? []
                      const latestCreditNote = cnList[0]
                      const creditNoteCount = cnList.length
                      return (
                        <tr key={`approved-obi-${triplet.id}`} className="align-top">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{triplet.obiNumber ?? 'OBI —'}</p>
                            <p className="text-xs text-gray-500">{triplet.milestone.description}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-800">{triplet.milestone.deal.client.name}</p>
                            <p className="text-xs text-gray-500">{triplet.milestone.deal.talent.name}</p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(triplet.grossAmount, triplet.milestone.deal.currency ?? 'GBP')}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            {latestCreditNote ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                  CN Raised
                                </span>
                                <p className="text-xs text-gray-600">
                                  {latestCreditNote.cnNumber ?? triplet.cnNumber ?? 'CN'}
                                  {' · '}
                                  {formatCurrency(Number(latestCreditNote.amount), triplet.milestone.deal.currency ?? 'GBP')}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  {creditNoteCount} CN cycle{creditNoteCount === 1 ? '' : 's'}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
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
                                  className="mt-1 block w-28 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
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
                                  className="mt-1 block w-52 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700"
                                />
                              </label>
                              <button
                                type="submit"
                                className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
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
        ) : null}
      </div>
    </div>
  )
}
