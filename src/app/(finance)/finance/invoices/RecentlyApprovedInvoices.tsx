'use client'

import Link from 'next/link'
import { amendApprovedInvoiceBody, raiseCreditNoteAndReraiseTriplet } from './actions'

type ApprovedInvoiceRow = {
  id: string
  invoiceRef: string
  invoiceDate: string
  clientName: string
  talentName: string
  dealId: string
  dealCurrency: string
  grossAmount: number
  invPaidAt: string | null
  poNumber: string | null
  invoiceNarrative: string | null
  invoiceAddress: string | null
  recipientContactName: string | null
  recipientContactEmail: string | null
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
}

export default function RecentlyApprovedInvoices({ rows }: { rows: ApprovedInvoiceRow[] }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-indigo-500" />
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">Recently Approved Invoices</h2>
        <p className="text-sm text-gray-500 mt-1">
          Approved records remain visible here for review, narrative checks, and PO/address confirmation.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-bold border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Invoice</th>
              <th className="px-6 py-4">Client / Talent</th>
              <th className="px-6 py-4">Body Summary</th>
              <th className="px-6 py-4 text-right">Gross</th>
              <th className="px-6 py-4">Paid</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">No approved invoices yet.</td>
              </tr>
            ) : (
              rows.map((triplet) => (
                <tr key={`approved-${triplet.id}`}>
                  <td className="px-6 py-4">
                    <Link href={`/finance/invoices/${triplet.id}`} className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                      {triplet.invoiceRef}
                    </Link>
                    <p className="text-xs text-gray-500">{triplet.invoiceDate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{triplet.clientName}</p>
                    <p className="text-xs text-gray-500">{triplet.talentName}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-600">PO: {triplet.poNumber ?? '—'}</p>
                    <p className="text-xs text-gray-600">Narrative: {triplet.invoiceNarrative ?? '—'}</p>
                    <p className="text-xs text-gray-600">Address: {triplet.invoiceAddress ?? '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">{formatCurrency(triplet.grossAmount, triplet.dealCurrency)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${triplet.invPaidAt ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {triplet.invPaidAt ? 'Paid' : 'Awaiting payment'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <Link
                        href={`/finance/invoices/${triplet.id}`}
                        className="inline-flex items-center rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Open Invoice
                      </Link>
                      <Link
                        href={`/finance/deals#deal-${triplet.dealId}`}
                        className="inline-flex items-center rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        Open Deal
                      </Link>
                      {!triplet.invPaidAt && (
                        <form action={amendApprovedInvoiceBody} className="space-y-1">
                          <input type="hidden" name="tripletId" value={triplet.id} />
                          <input
                            name="poNumber"
                            type="text"
                            defaultValue={triplet.poNumber ?? ''}
                            placeholder="PO Number"
                            className="block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                          />
                          <input
                            name="invoiceNarrative"
                            type="text"
                            defaultValue={triplet.invoiceNarrative ?? ''}
                            placeholder="Narrative"
                            className="block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                          />
                          <textarea
                            name="invoiceAddress"
                            defaultValue={triplet.invoiceAddress ?? ''}
                            placeholder="Invoice address"
                            rows={2}
                            className="block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                          >
                            Save body
                          </button>
                        </form>
                      )}
                      {!triplet.invPaidAt && (
                        <form action={raiseCreditNoteAndReraiseTriplet} className="space-y-1 pt-2 border-t border-zinc-200">
                          <input type="hidden" name="tripletId" value={triplet.id} />
                          <label className="block text-[10px] text-zinc-500 font-semibold">
                            Replacement invoice date
                            <input
                              name="replacementInvoiceDate"
                              type="date"
                              defaultValue={triplet.invoiceDate}
                              className="mt-1 block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block text-[10px] text-zinc-500 font-semibold">
                            Replacement gross
                            <input
                              name="replacementGrossAmount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              defaultValue={triplet.grossAmount.toFixed(2)}
                              className="mt-1 block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block text-[10px] text-zinc-500 font-semibold">
                            Credit note date
                            <input
                              name="cnDate"
                              type="date"
                              defaultValue={new Date().toISOString().slice(0, 10)}
                              className="mt-1 block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="block text-[10px] text-zinc-500 font-semibold">
                            Re-raise reason
                            <input
                              name="reason"
                              type="text"
                              required
                              maxLength={500}
                              placeholder="Why this invoice is being re-raised"
                              className="mt-1 block w-48 rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                          </label>
                          <button
                            type="submit"
                            className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            Credit note + Re-raise
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
