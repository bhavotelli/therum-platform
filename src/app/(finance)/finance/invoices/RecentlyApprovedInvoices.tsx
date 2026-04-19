'use client'

import Link from 'next/link'

type ApprovedInvoiceRow = {
  id: string
  invoiceRef: string
  invoiceDate: string
  clientName: string
  talentName: string
  grossAmount: number
  dealCurrency: string
  invPaidAt: string | null
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
}

export default function RecentlyApprovedInvoices({ rows }: { rows: ApprovedInvoiceRow[] }) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-indigo-500" />
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900">Recently Approved Invoices</h2>
          <p className="text-sm text-gray-500 mt-0.5">Open any invoice to view, edit body fields, or raise a credit note.</p>
        </div>
        <span className="text-xs font-semibold text-gray-400 tabular-nums">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider font-bold border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Invoice</th>
              <th className="px-6 py-4">Client / Talent</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Gross</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No approved invoices yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <Link
                      href={`/finance/invoices/${row.id}`}
                      className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {row.invoiceRef}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{row.clientName}</p>
                    <p className="text-xs text-gray-500">{row.talentName}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{row.invoiceDate}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">
                    {formatCurrency(row.grossAmount, row.dealCurrency)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${
                      row.invPaidAt
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.invPaidAt ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      {row.invPaidAt ? 'Paid' : 'Awaiting payment'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/finance/invoices/${row.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800 transition-colors opacity-70 group-hover:opacity-100"
                    >
                      Open
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
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
