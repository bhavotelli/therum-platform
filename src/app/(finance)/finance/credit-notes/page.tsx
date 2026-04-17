import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function CreditNotesPage() {
  const agency = await prisma.agency.findFirst({
    select: {
      id: true,
      name: true,
    },
  })

  if (!agency) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-zinc-900">Credit Notes</h1>
        </div>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-xs">Create or seed an agency to load credit note history.</p>
        </div>
      </div>
    )
  }

  const creditNotes = await prisma.manualCreditNote.findMany({
    where: {
      agencyId: agency.id,
    },
    include: {
      invoiceTriplet: {
        select: {
          obiNumber: true,
          invNumber: true,
          grossAmount: true,
          milestone: {
            select: {
              description: true,
              deal: {
                select: {
                  title: true,
                  currency: true,
                  client: {
                    select: { name: true },
                  },
                  talent: {
                    select: { name: true },
                  },
                },
              },
            },
          },
        },
      },
      createdByUser: {
        select: {
          name: true,
        },
      },
      replacementMilestone: {
        select: {
          id: true,
          description: true,
          grossAmount: true,
          invoiceDate: true,
          invoiceTriplet: {
            select: {
              id: true,
              invNumber: true,
              obiNumber: true,
              comNumber: true,
              approvalStatus: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  const tripletIds = Array.from(new Set(creditNotes.map((note) => note.invoiceTripletId)))
  const cnAuditLogs = tripletIds.length
    ? await prisma.adminAuditLog.findMany({
        where: {
          action: 'INVOICE_CREDIT_NOTED_RERAISED',
          targetType: 'INVOICE_TRIPLET',
          targetId: { in: tripletIds },
        },
        select: {
          targetId: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    : []

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
