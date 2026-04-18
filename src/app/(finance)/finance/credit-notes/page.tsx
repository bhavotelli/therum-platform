import { redirect } from 'next/navigation'

import { resolveFinancePageContext } from '@/lib/financeAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function CreditNotesPage() {
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-zinc-900">Credit Notes</h1>
        </div>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-xs">
            Link this finance account to an agency to load credit note history.
          </p>
        </div>
      </div>
    )
  }

  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('id, name').eq('id', financeCtx.agencyId).maybeSingle()

  if (!agency) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-zinc-900">Credit Notes</h1>
        </div>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">Agency not found.</p>
          <p className="text-zinc-500 text-sm max-w-xs">Your account references an agency that no longer exists.</p>
        </div>
      </div>
    )
  }

  const { data: noteRows } = await db
    .from('ManualCreditNote')
    .select('*')
    .eq('agencyId', agency.id as string)
    .order('createdAt', { ascending: false })

  const baseNotes = noteRows ?? []
  const tripletIdsForNotes = [...new Set(baseNotes.map((n) => n.invoiceTripletId as string))]
  const replacementMilestoneIds = baseNotes.map((n) => n.replacementMilestoneId).filter(Boolean) as string[]

  const { data: tripletRows } = tripletIdsForNotes.length
    ? await db
        .from('InvoiceTriplet')
        .select('id, obiNumber, invNumber, grossAmount, milestoneId')
        .in('id', tripletIdsForNotes)
    : { data: [] }
  const tripletMap = new Map((tripletRows ?? []).map((t) => [t.id as string, t]))

  const mileIds = [...new Set((tripletRows ?? []).map((t) => t.milestoneId as string))]
  const { data: mileRows } = mileIds.length
    ? await db.from('Milestone').select('id, description, dealId').in('id', mileIds)
    : { data: [] }
  const mileMap = new Map((mileRows ?? []).map((m) => [m.id as string, m]))

  const dealIds = [...new Set((mileRows ?? []).map((m) => m.dealId as string))]
  const { data: dealRows } = dealIds.length
    ? await db.from('Deal').select('id, title, currency, clientId, talentId').in('id', dealIds)
    : { data: [] }
  const dealMap = new Map((dealRows ?? []).map((d) => [d.id as string, d]))

  const clientIds = [...new Set((dealRows ?? []).map((d) => d.clientId as string))]
  const talentIds = [...new Set((dealRows ?? []).map((d) => d.talentId as string))]
  const [{ data: clientRows }, { data: talentRows }] = await Promise.all([
    clientIds.length ? db.from('Client').select('id, name').in('id', clientIds) : Promise.resolve({ data: [] }),
    talentIds.length ? db.from('Talent').select('id, name').in('id', talentIds) : Promise.resolve({ data: [] }),
  ])
  const clientMap = new Map((clientRows ?? []).map((c) => [c.id as string, c.name as string]))
  const talentMap = new Map((talentRows ?? []).map((t) => [t.id as string, t.name as string]))

  const userIds = [...new Set(baseNotes.map((n) => n.createdByUserId as string))]
  const { data: creatorRows } = userIds.length
    ? await db.from('User').select('id, name').in('id', userIds)
    : { data: [] }
  const creatorMap = new Map((creatorRows ?? []).map((u) => [u.id as string, u.name as string]))

  const { data: replacementMilestones } = replacementMilestoneIds.length
    ? await db.from('Milestone').select('id, description, grossAmount, invoiceDate').in('id', replacementMilestoneIds)
    : { data: [] }
  const replMap = new Map((replacementMilestones ?? []).map((m) => [m.id as string, m]))
  const { data: replTripletRows } = replacementMilestoneIds.length
    ? await db
        .from('InvoiceTriplet')
        .select('id, milestoneId, invNumber, obiNumber, comNumber, approvalStatus')
        .in('milestoneId', replacementMilestoneIds)
    : { data: [] }
  const replTripByMilestoneId = new Map((replTripletRows ?? []).map((t) => [t.milestoneId as string, t]))

  const creditNotes = baseNotes.map((note) => {
    const inv = tripletMap.get(note.invoiceTripletId as string)
    const ms = inv ? mileMap.get(inv.milestoneId as string) : undefined
    const deal = ms ? dealMap.get(ms.dealId as string) : undefined
    const replM = note.replacementMilestoneId ? replMap.get(note.replacementMilestoneId as string) : undefined
    const replInv = replM ? replTripByMilestoneId.get(replM.id as string) : undefined
    return {
      id: note.id as string,
      cnNumber: note.cnNumber as string,
      cnDate: note.cnDate as string,
      amount: note.amount,
      reason: note.reason as string,
      xeroCnId: note.xeroCnId as string | null,
      invoiceTripletId: note.invoiceTripletId as string,
      invoiceTriplet: {
        obiNumber: inv?.obiNumber as string | null,
        invNumber: inv?.invNumber as string | null,
        grossAmount: inv?.grossAmount,
        milestone: {
          description: (ms?.description as string) ?? '',
          deal: {
            title: (deal?.title as string) ?? '',
            currency: (deal?.currency as string) ?? 'GBP',
            client: { name: deal ? clientMap.get(deal.clientId as string) ?? '' : '' },
            talent: { name: deal ? talentMap.get(deal.talentId as string) ?? '' : '' },
          },
        },
      },
      createdByUser: { name: creatorMap.get(note.createdByUserId as string) ?? null },
      replacementMilestone: replM
        ? {
            id: replM.id as string,
            description: replM.description as string,
            grossAmount: replM.grossAmount,
            invoiceDate: replM.invoiceDate as string,
            invoiceTriplet: replInv
              ? {
                  id: replInv.id as string,
                  invNumber: replInv.invNumber as string | null,
                  obiNumber: replInv.obiNumber as string | null,
                  comNumber: replInv.comNumber as string | null,
                  approvalStatus: replInv.approvalStatus as string,
                }
              : null,
          }
        : null,
    }
  })

  const tripletIds = Array.from(new Set(creditNotes.map((note) => note.invoiceTripletId)))
  const { data: auditRows } = tripletIds.length
    ? await db
        .from('AdminAuditLog')
        .select('targetId, metadata, createdAt')
        .eq('action', 'INVOICE_CREDIT_NOTED_RERAISED')
        .eq('targetType', 'INVOICE_TRIPLET')
        .in('targetId', tripletIds)
        .order('createdAt', { ascending: false })
    : { data: [] }

  const cnAuditLogs = auditRows ?? []

  const latestAuditByTriplet = new Map<string, (typeof cnAuditLogs)[number]>()
  for (const log of cnAuditLogs) {
    if (!log.targetId || latestAuditByTriplet.has(log.targetId)) continue
    latestAuditByTriplet.set(log.targetId, log)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900">Credit Notes</h1>
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Total Raised</p>
          <p className="text-xl font-black text-zinc-900">{creditNotes.length}</p>
        </div>
      </div>

      {creditNotes.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No credit notes found.
          </p>
          <p className="text-zinc-500 text-sm max-w-xs">
            Credit notes raised from SBI/OBI amendment and re-raise flows will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">CN Number</th>
                <th className="px-4 py-3 text-left font-semibold">Deal / Milestone</th>
                <th className="px-4 py-3 text-left font-semibold">Client / Talent</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-semibold">Xero</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {creditNotes.map((note) => {
                const deal = note.invoiceTriplet.milestone.deal
                const auditLog = latestAuditByTriplet.get(note.invoiceTripletId)
                const metadata = (auditLog?.metadata ?? {}) as {
                  creditNote?: {
                    xeroSbiCnNumber?: string | null
                    xeroSbiCnId?: string | null
                    xeroComCnNumber?: string | null
                    xeroComCnId?: string | null
                  }
                }
                const sbiRef = metadata.creditNote?.xeroSbiCnNumber ?? metadata.creditNote?.xeroSbiCnId ?? null
                const comRef = metadata.creditNote?.xeroComCnNumber ?? metadata.creditNote?.xeroComCnId ?? null
                return (
                  <tr key={note.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{note.cnNumber}</p>
                      <p className="text-xs text-zinc-500">{formatDate(note.cnDate)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{deal.title}</p>
                      <p className="text-xs text-zinc-500">{note.invoiceTriplet.milestone.description}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Ref: {note.invoiceTriplet.obiNumber ?? note.invoiceTriplet.invNumber ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-800">{deal.client.name}</p>
                      <p className="text-xs text-zinc-500">{deal.talent.name}</p>
                      <p className="text-xs text-zinc-500 mt-1">Raised by {note.createdByUser.name ?? 'System'}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      {formatCurrency(Number(note.amount), deal.currency)}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 max-w-xs">{note.reason}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${
                            note.xeroCnId
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {note.xeroCnId ? 'Primary CN pushed' : 'Pending'}
                        </span>
                        {sbiRef ? <p className="text-[11px] text-zinc-600">SBI CN: {sbiRef}</p> : null}
                        {comRef ? <p className="text-[11px] text-zinc-600">COM CN: {comRef}</p> : null}
                      </div>
                      <details className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1">
                        <summary className="cursor-pointer text-[11px] font-semibold text-zinc-700">
                          View chain
                        </summary>
                        <div className="mt-2 space-y-1 text-[11px] text-zinc-600">
                          <p>
                            Original:{' '}
                            <span className="font-semibold text-zinc-800">
                              {note.invoiceTriplet.obiNumber ?? note.invoiceTriplet.invNumber ?? '—'}
                            </span>
                            {' · '}
                            {formatCurrency(Number(note.invoiceTriplet.grossAmount), deal.currency)}
                          </p>
                          <p>
                            CN:{' '}
                            <span className="font-semibold text-zinc-800">{note.cnNumber}</span>
                            {' · '}
                            {formatCurrency(Number(note.amount), deal.currency)}
                          </p>
                          {note.replacementMilestone?.invoiceTriplet ? (
                            <p>
                              Replacement:{' '}
                              <span className="font-semibold text-zinc-800">
                                {note.replacementMilestone.invoiceTriplet.obiNumber ??
                                  note.replacementMilestone.invoiceTriplet.invNumber ??
                                  note.replacementMilestone.invoiceTriplet.comNumber ??
                                  'Pending'}
                              </span>
                              {' · '}
                              {formatCurrency(Number(note.replacementMilestone.grossAmount), deal.currency)}
                              {' · '}
                              {note.replacementMilestone.invoiceTriplet.approvalStatus}
                            </p>
                          ) : (
                            <p>Replacement: Pending creation</p>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
