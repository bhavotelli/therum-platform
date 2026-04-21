import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { resolveFinancePageContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

import InvoicePrintButton from './InvoicePrintButton'
import {
  amendApprovedInvoiceBody,
  amendInvoiceDraft,
  approveInvoiceTriplet,
  clearXeroCleanupFlag,
  raiseCreditNoteAndReraiseTriplet,
  rejectInvoiceTriplet,
} from '../actions'

export const dynamic = 'force-dynamic'

type Params = Promise<{ tripletId: string }>

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDueDate(invoiceDate: Date, dueDays: number) {
  const d = new Date(invoiceDate)
  d.setDate(d.getDate() + dueDays)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

type XeroOrgProfile = { registeredName: string | null; registeredAddress: string | null }

function getCachedXeroOrgProfile(xeroAccountCodes: unknown): XeroOrgProfile {
  if (!xeroAccountCodes || typeof xeroAccountCodes !== 'object') return { registeredName: null, registeredAddress: null }
  const cached = (xeroAccountCodes as { xeroOrgProfile?: unknown }).xeroOrgProfile
  if (!cached || typeof cached !== 'object') return { registeredName: null, registeredAddress: null }
  const p = cached as { registeredName?: unknown; registeredAddress?: unknown }
  return {
    registeredName: typeof p.registeredName === 'string' && p.registeredName.trim() ? p.registeredName : null,
    registeredAddress: typeof p.registeredAddress === 'string' && p.registeredAddress.trim() ? p.registeredAddress : null,
  }
}

export default async function FinanceInvoiceViewerPage(props: { params: Params }) {
  const financeCtx = await resolveFinancePageContext()
  if (financeCtx.status === 'need_login') redirect('/login')
  if (financeCtx.status === 'need_impersonation') {
    redirect('/admin?notice=' + encodeURIComponent('Choose an agency in the Super Admin bar to view finance for that tenant.'))
  }
  if (financeCtx.status === 'need_agency') notFound()

  const agencyId = financeCtx.agencyId
  const params = await props.params
  const db = getSupabaseServiceRole()

  const { data: tripletRow } = await db.from('InvoiceTriplet').select('*').eq('id', params.tripletId).maybeSingle()
  if (!tripletRow) notFound()

  const { data: milestoneRow } = await db.from('Milestone').select('*').eq('id', tripletRow.milestoneId as string).maybeSingle()
  if (!milestoneRow) notFound()

  const { data: dealRow } = await db.from('Deal').select('*').eq('id', milestoneRow.dealId as string).maybeSingle()
  if (!dealRow || (dealRow.agencyId as string) !== agencyId) notFound()

  const [{ data: agencyRow }, { data: clientRow }, { data: talentRow }, { data: contactRows }] = await Promise.all([
    db.from('Agency').select('*').eq('id', dealRow.agencyId as string).maybeSingle(),
    db.from('Client').select('*').eq('id', dealRow.clientId as string).maybeSingle(),
    db.from('Talent').select('*').eq('id', dealRow.talentId as string).maybeSingle(),
    db.from('ClientContact').select('*').eq('clientId', dealRow.clientId as string).order('createdAt', { ascending: true }),
  ])
  if (!agencyRow || !clientRow || !talentRow) notFound()

  const roleRank: Record<string, number> = { FINANCE: 0, PRIMARY: 1, BILLING: 2, OTHER: 3 }
  const contacts = [...(contactRows ?? [])].sort((a, b) => {
    const ra = roleRank[String(a.role)] ?? 99
    const rb = roleRank[String(b.role)] ?? 99
    return ra !== rb ? ra - rb : new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
  })

  type ClientContactRow = (typeof contacts)[number]
  const deal = { ...dealRow, client: { ...clientRow, contacts }, talent: talentRow }
  const agency = agencyRow
  const talent = talentRow
  const client = deal.client

  const invoiceRef = tripletRow.invNumber ?? tripletRow.obiNumber ?? tripletRow.comNumber
  const approvalStatus = String(tripletRow.approvalStatus ?? 'PENDING')
  const isPending = approvalStatus === 'PENDING'
  const isApproved = approvalStatus === 'APPROVED'
  const isPaid = Boolean(tripletRow.invPaidAt)
  const xeroCleanupRequired = Boolean(tripletRow.xeroCleanupRequired)

  const recipientName =
    tripletRow.recipientContactName ??
    contacts.find((c: ClientContactRow) => c.role === 'FINANCE')?.name ??
    contacts.find((c: ClientContactRow) => c.role === 'PRIMARY')?.name ??
    contacts[0]?.name ?? client.name

  const recipientEmail =
    tripletRow.recipientContactEmail ??
    contacts.find((c: ClientContactRow) => c.role === 'FINANCE')?.email ??
    contacts.find((c: ClientContactRow) => c.role === 'PRIMARY')?.email ??
    contacts[0]?.email ?? null

  const orgProfile = getCachedXeroOrgProfile(agency.xeroAccountCodes)
  const agencyDisplayName = orgProfile.registeredName ?? agency.name
  const agencyAddress = orgProfile.registeredAddress

  const invoiceDateValue = new Date(tripletRow.invoiceDate)
  const grossAmount = Number(tripletRow.grossAmount)
  const netPayoutAmount = Number(tripletRow.netPayoutAmount)
  const commissionAmount = Number(tripletRow.commissionAmount)
  const vatAmount = agency.vatRegistered ? Number(((grossAmount * 20) / 120).toFixed(2)) : 0
  const currency = (dealRow.currency as string) || 'GBP'

  const statusConfig = {
    PENDING:  { label: 'Draft',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
    APPROVED: { label: isPaid ? 'Paid' : 'Approved', color: isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200' },
    REJECTED: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  }
  const status = statusConfig[approvalStatus as keyof typeof statusConfig] ?? statusConfig.PENDING

  return (
    <div className="invoice-print-page space-y-5 print:space-y-0 print:block">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .invoice-print-page { margin: 0 !important; padding: 0 !important; }
          .invoice-print-root {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/finance/invoices"
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Invoice Queue
        </Link>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.color}`}>
            {status.label}
          </span>
          <InvoicePrintButton invoiceRef={invoiceRef} clientName={client.name} />
        </div>
      </div>

      {/* Xero cleanup warning — shown when a partial push left orphaned Xero documents */}
      {xeroCleanupRequired && (
        <div className="print:hidden rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-red-800">Xero Cleanup Required</h2>
              <p className="mt-1 text-xs text-red-700 leading-relaxed">
                A previous Xero push failed mid-batch. One or more documents (invoice, credit note, or commission invoice)
                may have been partially created in Xero. <strong>Do not retry until you have voided any orphaned Xero documents</strong>,
                otherwise duplicate invoices will be created.
              </p>
              <ol className="mt-2 text-xs text-red-700 space-y-1 list-decimal list-inside">
                <li>Log into Xero and search for any draft/authorised documents created for this milestone.</li>
                <li>Void any orphaned documents you find.</li>
                <li>Click <strong>Mark as Cleaned Up</strong> below to re-enable the push.</li>
              </ol>
            </div>
          </div>
          <form action={clearXeroCleanupFlag.bind(null, tripletRow.id)} className="flex justify-end">
            <button
              type="submit"
              className="rounded-lg border border-red-300 bg-white px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
            >
              Mark as Cleaned Up — Re-enable Push
            </button>
          </form>
        </div>
      )}

      {/* PENDING: Draft edit + Approve / Reject */}
      {isPending && (
        <div className="print:hidden rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-5">
          <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wider">Edit Draft</h2>

          <form action={amendInvoiceDraft} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <input type="hidden" name="tripletId" value={tripletRow.id} />
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              Invoice Date
              <input
                name="invoiceDate"
                type="date"
                defaultValue={new Date(tripletRow.invoiceDate).toISOString().slice(0, 10)}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              Due (days)
              <input
                name="invDueDateDays"
                type="number"
                min="0"
                max="365"
                defaultValue={tripletRow.invDueDateDays}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              Gross ({currency})
              <input
                name="grossAmount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={grossAmount.toFixed(2)}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
              PO Number
              <input
                name="poNumber"
                type="text"
                defaultValue={tripletRow.poNumber ?? ''}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 xl:col-span-2">
              Narrative
              <input
                name="invoiceNarrative"
                type="text"
                defaultValue={tripletRow.invoiceNarrative ?? ''}
                placeholder={tripletRow.milestone?.description ?? ''}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 col-span-2 md:col-span-3">
              Invoice Address
              <textarea
                name="invoiceAddress"
                defaultValue={tripletRow.invoiceAddress ?? ''}
                placeholder="Leave blank to use Xero contact address"
                rows={2}
                className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 resize-none"
              />
            </label>
            <div className="col-span-2 md:col-span-3 xl:col-span-3 flex items-end">
              <button
                type="submit"
                className="rounded-lg border border-amber-300 bg-white px-4 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Save Draft
              </button>
            </div>
          </form>

          <div className="border-t border-amber-200 pt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-600">Approve as:</span>
            <form action={approveInvoiceTriplet} className="flex items-center gap-2">
              <input type="hidden" name="tripletId" value={tripletRow.id} />
              <select
                name="recipientContactEmail"
                defaultValue={
                  contacts.find((c: ClientContactRow) => c.role === 'FINANCE')?.email ??
                  contacts.find((c: ClientContactRow) => c.role === 'PRIMARY')?.email ??
                  contacts[0]?.email ?? ''
                }
                className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700"
              >
                {contacts.map((c: ClientContactRow) => (
                  <option key={c.id} value={c.email as string}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-600 transition-all"
              >
                Approve & Push to Xero
              </button>
            </form>
            <form action={rejectInvoiceTriplet.bind(null, tripletRow.id)}>
              <button
                type="submit"
                className="rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all"
              >
                Reject
              </button>
            </form>
          </div>
        </div>
      )}

      {/* APPROVED + unpaid: Body edit + CN re-raise */}
      {isApproved && !isPaid && (
        <div className="print:hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-5">
          <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Manage Invoice</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Edit body */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Update Body Fields</h3>
              <form action={amendApprovedInvoiceBody} className="space-y-2">
                <input type="hidden" name="tripletId" value={tripletRow.id} />
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  PO Number
                  <input
                    name="poNumber"
                    type="text"
                    defaultValue={tripletRow.poNumber ?? ''}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Narrative
                  <input
                    name="invoiceNarrative"
                    type="text"
                    defaultValue={tripletRow.invoiceNarrative ?? ''}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Invoice Address
                  <textarea
                    name="invoiceAddress"
                    defaultValue={tripletRow.invoiceAddress ?? ''}
                    rows={2}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 resize-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Payment Terms (days)
                  <input
                    name="invDueDateDays"
                    type="number"
                    min="0"
                    max="365"
                    defaultValue={tripletRow.invDueDateDays ?? 30}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Save Body
                </button>
              </form>
            </div>

            {/* Credit note + re-raise */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">Credit Note & Re-raise</h3>
              <form action={raiseCreditNoteAndReraiseTriplet} className="space-y-2">
                <input type="hidden" name="tripletId" value={tripletRow.id} />
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Replacement Invoice Date
                  <input
                    name="replacementInvoiceDate"
                    type="date"
                    defaultValue={new Date(tripletRow.invoiceDate).toISOString().slice(0, 10)}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Replacement Gross ({currency})
                  <input
                    name="replacementGrossAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    defaultValue={grossAmount.toFixed(2)}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Credit Note Date
                  <input
                    name="cnDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
                  Re-raise Reason
                  <input
                    name="reason"
                    type="text"
                    required
                    maxLength={500}
                    placeholder="Why this invoice is being re-raised"
                    className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-gray-800"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  Credit Note + Re-raise
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Document */}
      <section className="invoice-print-root rounded-2xl border border-zinc-200 bg-white shadow-sm print:shadow-none print:overflow-visible print:border-zinc-300">
        <div className="p-10 md:p-14 space-y-10">

          {/* Header: Agency (left) + INVOICE (right) */}
          <div className="flex items-start justify-between gap-8 pb-8 border-b-2 border-zinc-900">
            <div className="space-y-1 max-w-sm">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">{agencyDisplayName}</h2>
              {agencyAddress && (
                <p className="text-sm leading-relaxed text-zinc-500 whitespace-pre-wrap">{agencyAddress}</p>
              )}
              {agency.vatNumber && (
                <p className="text-sm text-zinc-500">VAT No: {agency.vatNumber}</p>
              )}
            </div>
            <div className="text-right shrink-0 space-y-2">
              <h1 className="text-4xl font-black tracking-widest text-zinc-900">INVOICE</h1>
              <div className="space-y-0.5 text-sm text-zinc-600">
                <p>
                  <span className="text-zinc-400">No.</span>{' '}
                  <span className="font-bold text-zinc-900">{invoiceRef ?? '—'}</span>
                </p>
                <p>
                  <span className="text-zinc-400">Date:</span>{' '}
                  <span className="font-medium text-zinc-900">{formatDate(invoiceDateValue)}</span>
                </p>
                <p>
                  <span className="text-zinc-400">Due:</span>{' '}
                  <span className="font-medium text-zinc-900">{formatDueDate(invoiceDateValue, tripletRow.invDueDateDays)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* On Behalf notice */}
          {tripletRow.invoicingModel === 'ON_BEHALF' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600">On Behalf Of</p>
              <p className="text-sm text-amber-900 mt-0.5">
                Issued by <span className="font-semibold">{agency.name}</span> on behalf of{' '}
                <span className="font-semibold">{talent.name}</span>.
              </p>
              {talent.vatNumber && (
                <p className="text-xs text-amber-700 mt-0.5">Talent VAT: {talent.vatNumber}</p>
              )}
            </div>
          )}

          {/* Bill To + Work By */}
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2">Bill To</p>
              <p className="text-xl font-bold text-zinc-900">{client.name}</p>
              <p className="text-sm text-zinc-600 mt-0.5">{recipientName}</p>
              {recipientEmail && <p className="text-sm text-zinc-500">{recipientEmail}</p>}
              {tripletRow.invoiceAddress && (
                <p className="text-sm text-zinc-500 mt-1 whitespace-pre-wrap">{tripletRow.invoiceAddress}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-2">Services By</p>
              <p className="text-xl font-bold text-zinc-900">{talent.name}</p>
              <div className="mt-2 space-y-0.5 text-sm text-zinc-500">
                {tripletRow.poNumber && <p>PO: <span className="font-medium text-zinc-700">{tripletRow.poNumber}</span></p>}
                <p>Deal: <span className="font-medium text-zinc-700">{dealRow.title as string}</span></p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider border-b border-zinc-200">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Description</th>
                  <th className="px-5 py-3 text-right font-semibold">Qty</th>
                  <th className="px-5 py-3 text-right font-semibold">Unit Price</th>
                  <th className="px-5 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-zinc-100">
                  <td className="px-5 py-4 text-zinc-800">
                    <p className="font-medium">{milestoneRow.description as string}</p>
                    {tripletRow.invoiceNarrative && (
                      <p className="text-xs text-zinc-400 mt-1">{tripletRow.invoiceNarrative}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-500">1</td>
                  <td className="px-5 py-4 text-right text-zinc-700">
                    {formatCurrency(agency.vatRegistered ? grossAmount - vatAmount : grossAmount, currency)}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-zinc-900">
                    {formatCurrency(agency.vatRegistered ? grossAmount - vatAmount : grossAmount, currency)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                {agency.vatRegistered ? (
                  <>
                    <tr className="border-t border-zinc-100 bg-zinc-50/60">
                      <td colSpan={3} className="px-5 py-3 text-right text-sm font-medium text-zinc-500">Subtotal (ex. VAT)</td>
                      <td className="px-5 py-3 text-right font-semibold text-zinc-800">
                        {formatCurrency(grossAmount - vatAmount, currency)}
                      </td>
                    </tr>
                    <tr className="border-t border-zinc-100 bg-zinc-50/60">
                      <td colSpan={3} className="px-5 py-3 text-right text-sm font-medium text-zinc-500">VAT (20%)</td>
                      <td className="px-5 py-3 text-right font-semibold text-zinc-800">
                        {formatCurrency(vatAmount, currency)}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr className="border-t border-zinc-100 bg-zinc-50/60">
                    <td colSpan={3} className="px-5 py-3 text-right text-sm font-medium text-zinc-500">Subtotal</td>
                    <td className="px-5 py-3 text-right font-semibold text-zinc-800">
                      {formatCurrency(grossAmount, currency)}
                    </td>
                  </tr>
                )}
                <tr className="border-t-2 border-zinc-900">
                  <td colSpan={3} className="px-5 py-4 text-right text-base font-bold text-zinc-900">Total</td>
                  <td className="px-5 py-4 text-right text-2xl font-black text-zinc-900">
                    {formatCurrency(grossAmount, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Financials summary (screen only) */}
          {tripletRow.invoicingModel === 'SELF_BILLING' && (
            <div className="print:hidden border-t border-zinc-100 pt-6 grid grid-cols-3 gap-4">
              {[
                { label: 'Gross (INV)', value: formatCurrency(grossAmount, currency), color: 'text-zinc-900' },
                { label: 'Net Payout (SBI)', value: formatCurrency(netPayoutAmount, currency), color: 'text-indigo-600' },
                { label: 'Commission (COM)', value: formatCurrency(commissionAmount, currency), color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{label}</p>
                  <p className={`text-xl font-black mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </section>
    </div>
  )
}
