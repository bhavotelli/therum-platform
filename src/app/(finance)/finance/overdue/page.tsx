import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import Link from 'next/link'
import { createChaseNote } from './actions'

export const dynamic = 'force-dynamic'

function formatDate(value: Date | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

function toDateInputValue(value: Date | null) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

export default async function OverduePage() {
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
        <h1 className="text-2xl font-bold text-zinc-900">Overdue Invoices</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-xs">
            Link this finance account to an agency to view overdue items.
          </p>
        </div>
      </div>
    )
  }

  const { agencyId } = financeCtx

  const overdueTriplets = await prisma.invoiceTriplet.findMany({
    where: {
      approvalStatus: 'APPROVED',
      invPaidAt: null,
      milestone: {
        deal: {
          agencyId,
        },
      },
    },
    include: {
      milestone: {
        select: {
          id: true,
          description: true,
          invoiceDate: true,
          deal: {
            select: {
              id: true,
              title: true,
              currency: true,
              client: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      chaseNotes: {
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          createdByUser: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      invoiceDate: 'asc',
    },
  })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const overdueRows = overdueTriplets
    .map((triplet) => {
      const dueDate = new Date(triplet.invoiceDate)
      dueDate.setDate(dueDate.getDate() + triplet.invDueDateDays)
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      const daysOverdue = Math.floor((today.getTime() - dueDateOnly.getTime()) / 86400000)

      const primaryInvoiceRef = triplet.invNumber ?? triplet.obiNumber

      const latestNextChaseDate = triplet.chaseNotes[0]?.nextChaseDate ?? null
      const followUpDue =
        latestNextChaseDate !== null &&
        new Date(
          latestNextChaseDate.getFullYear(),
          latestNextChaseDate.getMonth(),
          latestNextChaseDate.getDate()
        ).getTime() <= today.getTime()

      return {
        triplet,
        dueDate,
        daysOverdue,
        primaryInvoiceRef: primaryInvoiceRef ?? '—',
        latestNextChaseDate,
        followUpDue,
      }
    })
    .filter((row) => row.daysOverdue > 0)

  const totalOverdueValue = overdueRows.reduce((sum, row) => sum + Number(row.triplet.grossAmount), 0)

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Overdue Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Monitor overdue receivables and log chase history per invoice thread.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Overdue count</p>
            <p className="text-xl font-black text-zinc-900">{overdueRows.length}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Overdue value</p>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(totalOverdueValue, 'GBP')}</p>
          </div>
        </div>
      </header>

      {overdueRows.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No overdue invoices.
          </p>
          <p className="text-zinc-500 text-sm max-w-xs">
            Invoices past due will appear here for chase logging and collection tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {overdueRows.map(({ triplet, dueDate, daysOverdue, primaryInvoiceRef, latestNextChaseDate, followUpDue }) => (
            <section key={triplet.id} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-zinc-900">{primaryInvoiceRef}</h2>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${
                          daysOverdue >= 14
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {daysOverdue} day{daysOverdue === 1 ? '' : 's'} overdue
                      </span>
                      {followUpDue && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold bg-purple-50 text-purple-700 border-purple-200">
                          Follow up due
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 mt-1">
                      {triplet.milestone.deal.client.name} · {triplet.milestone.deal.title}
                    </p>
                    {(triplet.recipientContactName || triplet.recipientContactEmail) && (
                      <p className="text-xs text-zinc-500 mt-1">
                        Recipient: {triplet.recipientContactName ?? '—'}
                        {triplet.recipientContactEmail ? ` (${triplet.recipientContactEmail})` : ''}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500 mt-1">
                      Milestone: {triplet.milestone.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm min-w-[260px]">
                    <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Amount</p>
                      <p className="font-bold text-zinc-900">
                        {formatCurrency(Number(triplet.grossAmount), triplet.milestone.deal.currency)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Due date</p>
                      <p className="font-bold text-zinc-900">{formatDate(dueDate)}</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Next chase</p>
                      <p className="font-bold text-zinc-900">{formatDate(latestNextChaseDate)}</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Credit note</p>
                      <Link href="/finance/credit-notes" className="font-semibold text-teal-700 hover:text-teal-800">
                        Raise from queue
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                <div className="p-5 border-b lg:border-b-0 lg:border-r border-zinc-100">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 mb-3">Chase thread</h3>
                  {triplet.chaseNotes.length === 0 ? (
                    <p className="text-sm text-zinc-500">No chase notes logged yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {triplet.chaseNotes.map((note) => (
                        <article key={note.id} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-xs font-semibold text-zinc-800">
                              {note.contactedName} · {note.method}
                            </p>
                            <p className="text-[11px] text-zinc-500">{formatDate(note.createdAt)}</p>
                          </div>
                          <p className="text-xs text-zinc-500 mb-1">
                            {note.contactedEmail} · by {note.createdByUser.name}
                          </p>
                          <p className="text-sm text-zinc-700">{note.note}</p>
                          {note.nextChaseDate && (
                            <p className="text-xs text-zinc-600 mt-2">Next chase: {formatDate(note.nextChaseDate)}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-700 mb-3">Log chase note</h3>
                  <form action={createChaseNote} className="space-y-3">
                    <input type="hidden" name="invoiceTripletId" value={triplet.id} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        name="contactedName"
                        placeholder="Contact name"
                        required
                        defaultValue={triplet.recipientContactName ?? ''}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        name="contactedEmail"
                        type="email"
                        placeholder="Contact email"
                        required
                        defaultValue={triplet.recipientContactEmail ?? ''}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select name="method" defaultValue="EMAIL" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Phone</option>
                        <option value="IN_PERSON">In person</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <input
                        name="nextChaseDate"
                        type="date"
                        defaultValue={toDateInputValue(latestNextChaseDate)}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <textarea
                      name="note"
                      placeholder="What was discussed, commitment date, blockers..."
                      required
                      rows={3}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
                    >
                      Save chase note
                    </button>
                  </form>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
