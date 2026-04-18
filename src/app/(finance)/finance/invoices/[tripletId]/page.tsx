import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { resolveFinancePageContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { Json } from '@/types/database'

import InvoicePrintButton from './InvoicePrintButton'
import { xero } from '@/lib/xero'

export const dynamic = 'force-dynamic'

type Params = Promise<{ tripletId: string }>

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount)
}

function formatDueDate(invoiceDate: Date, dueDays: number) {
  const dueDate = new Date(invoiceDate)
  dueDate.setDate(dueDate.getDate() + dueDays)
  return dueDate.toLocaleDateString('en-GB')
}

type XeroOrgProfile = {
  registeredName: string | null
  registeredAddress: string | null
}

function getCachedXeroOrgProfile(xeroAccountCodes: unknown): XeroOrgProfile {
  if (!xeroAccountCodes || typeof xeroAccountCodes !== 'object') {
    return { registeredName: null, registeredAddress: null }
  }
  const cached = (xeroAccountCodes as { xeroOrgProfile?: unknown }).xeroOrgProfile
  if (!cached || typeof cached !== 'object') {
    return { registeredName: null, registeredAddress: null }
  }
  const parsed = cached as { registeredName?: unknown; registeredAddress?: unknown }
  return {
    registeredName: typeof parsed.registeredName === 'string' && parsed.registeredName.trim().length > 0 ? parsed.registeredName : null,
    registeredAddress:
      typeof parsed.registeredAddress === 'string' && parsed.registeredAddress.trim().length > 0 ? parsed.registeredAddress : null,
  }
}

async function getXeroOrgProfile(agency: {
  id: string
  xeroTenantId: string | null
  xeroTokens: string | null
  xeroAccountCodes: unknown
}): Promise<XeroOrgProfile> {
  const cachedProfile = getCachedXeroOrgProfile(agency.xeroAccountCodes)
  if (!agency.xeroTenantId || !agency.xeroTokens) {
    return cachedProfile
  }

  try {
    const tokenSet = JSON.parse(agency.xeroTokens)
    await xero.setTokenSet(tokenSet)
    const response = await (xero as unknown as {
      accountingApi: {
        getOrganisations: (tenantId: string) => Promise<{
          body?: { organisations?: Array<Record<string, unknown>> }
        }>
      }
    }).accountingApi.getOrganisations(agency.xeroTenantId)
    const org = response?.body?.organisations?.[0] ?? {}
    const addresses = Array.isArray(org.addresses) ? (org.addresses as Array<Record<string, unknown>>) : []
    const primaryAddress = (addresses.find((address) => address?.addressType === 'POBOX') ??
      addresses.find((address) => address?.addressType === 'STREET') ??
      addresses[0]) as Record<string, unknown> | undefined

    const registeredAddress = primaryAddress
      ? [primaryAddress.addressLine1, primaryAddress.addressLine2, primaryAddress.city, primaryAddress.region, primaryAddress.postalCode, primaryAddress.country]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          .join(', ')
      : null

    const registeredName =
      (typeof org.legalName === 'string' && org.legalName.trim().length > 0 ? org.legalName : null) ??
      (typeof org.name === 'string' && org.name.trim().length > 0 ? org.name : null)

    const profile = { registeredName, registeredAddress }
    const db = getSupabaseServiceRole()
    await db
      .from('Agency')
      .update({
        xeroAccountCodes: {
          ...(agency.xeroAccountCodes && typeof agency.xeroAccountCodes === 'object'
            ? (agency.xeroAccountCodes as Record<string, unknown>)
            : {}),
          xeroOrgProfile: profile,
        } as Json,
      })
      .eq('id', agency.id)
    return profile
  } catch {
    return cachedProfile
  }
}

export default async function FinanceInvoiceViewerPage(props: { params: Params }) {
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
    notFound()
  }

  const agencyId = financeCtx.agencyId

  const params = await props.params
  const db = getSupabaseServiceRole()
  const { data: tripletRow } = await db.from('InvoiceTriplet').select('*').eq('id', params.tripletId).maybeSingle()
  if (!tripletRow) notFound()

  const { data: milestoneRow } = await db
    .from('Milestone')
    .select('*')
    .eq('id', tripletRow.milestoneId as string)
    .maybeSingle()
  if (!milestoneRow) notFound()

  const { data: dealRow } = await db.from('Deal').select('*').eq('id', milestoneRow.dealId as string).maybeSingle()
  if (!dealRow || (dealRow.agencyId as string) !== agencyId) notFound()

  const [{ data: agencyRow }, { data: clientRow }, { data: talentRow }, { data: contactRows }] = await Promise.all([
    db.from('Agency').select('*').eq('id', dealRow.agencyId as string).maybeSingle(),
    db.from('Client').select('*').eq('id', dealRow.clientId as string).maybeSingle(),
    db.from('Talent').select('*').eq('id', dealRow.talentId as string).maybeSingle(),
    db
      .from('ClientContact')
      .select('*')
      .eq('clientId', dealRow.clientId as string)
      .order('createdAt', { ascending: true }),
  ])

  if (!agencyRow || !clientRow || !talentRow) notFound()

  const roleRank: Record<string, number> = { FINANCE: 0, PRIMARY: 1, BILLING: 2, OTHER: 3 }
  const contacts = [...(contactRows ?? [])].sort((a, b) => {
    const ra = roleRank[String(a.role)] ?? 99
    const rb = roleRank[String(b.role)] ?? 99
    if (ra !== rb) return ra - rb
    return new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime()
  })

  const triplet = {
    ...tripletRow,
    milestone: {
      ...milestoneRow,
      deal: {
        ...dealRow,
        agency: agencyRow,
        client: { ...clientRow, contacts },
        talent: talentRow,
      },
    },
  }

  const deal = triplet.milestone.deal
  const agency = deal.agency
  const talent = deal.talent
  const client = deal.client
  type ClientContactRow = (typeof client.contacts)[number]
  const invoiceRef = triplet.invNumber ?? triplet.obiNumber ?? triplet.comNumber
  const recipientName =
    triplet.recipientContactName ??
    client.contacts.find((c: ClientContactRow) => c.role === 'FINANCE')?.name ??
    client.contacts.find((c: ClientContactRow) => c.role === 'PRIMARY')?.name ??
    client.contacts[0]?.name ??
    client.name

  const recipientEmail =
    triplet.recipientContactEmail ??
    client.contacts.find((c: ClientContactRow) => c.role === 'FINANCE')?.email ??
    client.contacts.find((c: ClientContactRow) => c.role === 'PRIMARY')?.email ??
    client.contacts[0]?.email ??
    null

  const xeroOrgProfile = await getXeroOrgProfile({
    id: agency.id,
    xeroTenantId: agency.xeroTenantId ?? null,
    xeroTokens: agency.xeroTokens ?? null,
    xeroAccountCodes: agency.xeroAccountCodes ?? null,
  })
  const agencyRegisteredName = xeroOrgProfile.registeredName ?? agency.name
  const agencyRegisteredAddress = xeroOrgProfile.registeredAddress
  const invoiceDateValue = new Date(triplet.invoiceDate)
  const dueDateLabel = formatDueDate(invoiceDateValue, triplet.invDueDateDays)
  const grossAmount = Number(triplet.grossAmount)
  const vatIncludedAmount = agency.vatRegistered ? Number(((grossAmount * 20) / 120).toFixed(2)) : 0

  return (
    <div className="invoice-print-page space-y-6 print:space-y-0">
      <style>{`
        html[data-pdf-mode='minimal'] .pdf-optional {
          display: none !important;
        }
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          html, body {
            background: #fff !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          .invoice-print-root, .invoice-print-root * {
            visibility: visible !important;
          }
          .invoice-print-root {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card {
            border: 1px solid #d4d4d8 !important;
            box-shadow: none !important;
            border-radius: 10px !important;
          }
          .print-table-head {
            background: #fff !important;
          }
          .print-no-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .export-toolbar {
            display: none !important;
          }
        }
      `}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/finance/invoices"
          className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Back to Invoice Queue
        </Link>
        <InvoicePrintButton invoiceRef={invoiceRef} clientName={client.name} />
      </div>

      <section className="invoice-print-root print-card rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm print:shadow-none print:border-zinc-300">
        <div className="flex items-start justify-between gap-8 pb-8 border-b border-zinc-300">
          <div className="max-w-md">
            <h2 className="text-4xl font-semibold tracking-tight text-zinc-900">{agencyRegisteredName}</h2>
            {agencyRegisteredAddress ? (
              <p className="mt-2 text-base leading-relaxed text-zinc-600 whitespace-pre-wrap">{agencyRegisteredAddress}</p>
            ) : null}
            <p className="mt-1 text-base text-zinc-600">VAT No: {agency.vatNumber ?? 'Not provided'}</p>
          </div>
          <div className="text-right min-w-64">
            <h1 className="text-4xl font-bold tracking-wide text-zinc-900">INVOICE</h1>
            <div className="mt-3 space-y-1 text-base text-zinc-600">
              <p>
                Invoice No: <span className="font-semibold text-zinc-900">{invoiceRef}</span>
              </p>
              <p>Date: {invoiceDateValue.toLocaleDateString('en-GB')}</p>
              <p>Due: {dueDateLabel}</p>
            </div>
          </div>
        </div>

        {triplet.invoicingModel === 'ON_BEHALF' ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs uppercase tracking-wider font-semibold text-amber-700">On Behalf Of Invoice</p>
            <p className="text-sm text-amber-900 mt-1">
              Issued by {agency.name} on behalf of {talent.name}.
            </p>
            <p className="text-sm text-amber-900">
              Talent Company: {talent.name} · VAT: {talent.vatNumber ?? 'Not provided'}
            </p>
          </div>
        ) : null}

        <div className="mt-10 print-no-break">
          <p className="text-xs uppercase tracking-[0.12em] font-semibold text-zinc-500">Bill To</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{client.name}</p>
          <p className="mt-1 text-lg text-zinc-600">{recipientName}</p>
          <p className="text-lg text-zinc-600">{recipientEmail ?? 'No recipient email recorded'}</p>
          <div className="mt-2 whitespace-pre-wrap text-base text-zinc-600">
            {triplet.invoiceAddress ?? ''}
          </div>
        </div>

        <div className="print-card print-no-break mt-8 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.12em] font-semibold text-zinc-500">Talent / Work Performed By</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{talent.name}</p>
        </div>

        <div className="pdf-optional print-card print-no-break mt-8 rounded-lg border border-zinc-200 p-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Invoice Summary</p>
          <p className="text-sm text-zinc-700 mt-1">Deal: {deal.title}</p>
          <p className="text-sm text-zinc-700">Milestone: {triplet.milestone.description}</p>
          {triplet.invoicingModel === 'SELF_BILLING' ? (
            <p className="text-sm text-zinc-700">Talent: {talent.name}</p>
          ) : null}
          <p className="text-sm text-zinc-700">PO Number: {triplet.poNumber ?? '—'}</p>
        </div>

        <div className="print-card print-no-break mt-6 rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="print-table-head bg-zinc-50 text-zinc-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100">
                <td className="px-4 py-4 text-zinc-800">
                  <p className="font-medium">{triplet.milestone.description}</p>
                  {triplet.invoiceNarrative ? <p className="text-xs text-zinc-500 mt-1">{triplet.invoiceNarrative}</p> : null}
                </td>
                <td className="px-4 py-4 text-right text-zinc-700">1</td>
                <td className="px-4 py-4 text-right text-zinc-700">
                  {formatCurrency(grossAmount, deal.currency)}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-zinc-900">
                  {formatCurrency(grossAmount, deal.currency)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              {agency.vatRegistered ? (
                <>
                  <tr className="border-t border-zinc-100 bg-zinc-50">
                    <td colSpan={3} className="px-4 py-3 text-right font-medium text-zinc-700">Subtotal</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      {formatCurrency(Number((grossAmount - vatIncludedAmount).toFixed(2)), deal.currency)}
                    </td>
                  </tr>
                  <tr className="border-t border-zinc-100 bg-zinc-50">
                    <td colSpan={3} className="px-4 py-3 text-right font-medium text-zinc-700">VAT (20%)</td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      {formatCurrency(vatIncludedAmount, deal.currency)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr className="border-t border-zinc-100 bg-zinc-50">
                  <td colSpan={3} className="px-4 py-3 text-right font-medium text-zinc-700">Subtotal</td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                    {formatCurrency(grossAmount, deal.currency)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-zinc-900 bg-zinc-50">
                <td colSpan={3} className="px-4 py-3 text-right text-lg font-bold text-zinc-900">TOTAL</td>
                <td className="px-4 py-3 text-right text-2xl font-bold text-emerald-700">
                  {formatCurrency(grossAmount, deal.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </section>
    </div>
  )
}
