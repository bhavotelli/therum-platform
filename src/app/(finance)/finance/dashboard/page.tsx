import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveFinancePageContext } from '@/lib/financeAuth'

export const dynamic = 'force-dynamic'

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

export default async function FinanceDashboardPage() {
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
        <h1 className="text-2xl font-bold text-zinc-900">Finance Dashboard</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-sm">
            Link this finance account to an agency, or create one, to load the dashboard.
          </p>
        </div>
      </div>
    )
  }

  const agency = await prisma.agency.findUnique({
    where: { id: financeCtx.agencyId },
    select: {
      id: true,
      name: true,
      xeroTenantId: true,
    },
  })

  if (!agency) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900">Finance Dashboard</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">Agency not found.</p>
          <p className="text-zinc-500 text-sm max-w-sm">Your account references an agency that no longer exists.</p>
        </div>
      </div>
    )
  }

  const [pendingApprovals, pendingExpenses, payoutReadyCount, payoutReadyRows, approvedUnpaidTriplets, recentTriplets, recentExpenses, recentChaseNotes, recentCreditNotes] = await Promise.all([
    prisma.invoiceTriplet.count({
      where: {
        approvalStatus: 'PENDING',
        milestone: {
          deal: { agencyId: agency.id },
        },
      },
    }),
    prisma.dealExpense.count({
      where: {
        agencyId: agency.id,
        status: 'PENDING',
      },
    }),
    prisma.milestone.count({
      where: {
        payoutStatus: 'READY',
        deal: { agencyId: agency.id },
      },
    }),
    prisma.milestone.findMany({
      where: {
        payoutStatus: 'READY',
        deal: { agencyId: agency.id },
      },
      select: {
        id: true,
        grossAmount: true,
        invoiceTriplet: {
          select: {
            netPayoutAmount: true,
          },
        },
      },
      take: 100,
    }),
    prisma.invoiceTriplet.findMany({
      where: {
        approvalStatus: 'APPROVED',
        invPaidAt: null,
        milestone: {
          deal: { agencyId: agency.id },
        },
      },
      select: {
        id: true,
        grossAmount: true,
        invoiceDate: true,
        invDueDateDays: true,
        chaseNotes: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { nextChaseDate: true },
        },
      },
      take: 200,
    }),
    prisma.invoiceTriplet.findMany({
      where: {
        milestone: {
          deal: { agencyId: agency.id },
        },
      },
      select: {
        id: true,
        invNumber: true,
        obiNumber: true,
        approvalStatus: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 6,
    }),
    prisma.dealExpense.findMany({
      where: {
        agencyId: agency.id,
        status: {
          in: ['APPROVED', 'EXCLUDED'],
        },
      },
      select: {
        id: true,
        description: true,
        status: true,
        approvedAt: true,
        updatedAt: true,
        approvedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 6,
    }),
    prisma.chaseNote.findMany({
      where: {
        agencyId: agency.id,
      },
      select: {
        id: true,
        note: true,
        contactedName: true,
        method: true,
        createdAt: true,
        invoiceTriplet: {
          select: {
            invNumber: true,
            obiNumber: true,
          },
        },
        createdByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 6,
    }),
    prisma.manualCreditNote.findMany({
      where: {
        agencyId: agency.id,
      },
      select: {
        id: true,
        cnNumber: true,
        amount: true,
        createdAt: true,
        invoiceTriplet: {
          select: {
            obiNumber: true,
            invNumber: true,
            milestone: {
              select: {
                deal: {
                  select: {
                    currency: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 6,
    }),
  ])

  const today = new Date()
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const overdueRows = approvedUnpaidTriplets
    .map((triplet) => {
      const dueDate = new Date(triplet.invoiceDate)
      dueDate.setDate(dueDate.getDate() + triplet.invDueDateDays)
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      const daysOverdue = Math.floor((todayDateOnly.getTime() - dueDateOnly.getTime()) / 86400000)
      const latestNextChaseDate = triplet.chaseNotes[0]?.nextChaseDate ?? null
      const followUpDue =
        latestNextChaseDate !== null &&
        new Date(
          latestNextChaseDate.getFullYear(),
          latestNextChaseDate.getMonth(),
          latestNextChaseDate.getDate()
        ).getTime() <= todayDateOnly.getTime()

      return {
        ...triplet,
        daysOverdue,
        followUpDue,
      }
    })
    .filter((triplet) => triplet.daysOverdue > 0)

  const overdueCount = overdueRows.length
  const followUpDueCount = overdueRows.filter((row) => row.followUpDue).length
  const overdueValue = overdueRows.reduce((sum, row) => sum + Number(row.grossAmount), 0)
  const payoutNetDue = payoutReadyRows.reduce(
    (sum, row) => sum + Number(row.invoiceTriplet?.netPayoutAmount ?? row.grossAmount),
    0
  )
  const xeroConnected = Boolean(agency.xeroTenantId)

  type ActivityItem = {
    id: string
    timestamp: Date
    title: string
    detail: string
    href: string
    tone: string
  }

  const activityItems: ActivityItem[] = [
    ...recentTriplets.map((triplet) => ({
      id: `triplet-${triplet.id}`,
      timestamp: triplet.updatedAt,
      title: `Invoice ${triplet.approvalStatus.toLowerCase()}`,
      detail: `${triplet.invNumber ?? triplet.obiNumber ?? 'Invoice triplet'} moved to ${triplet.approvalStatus}.`,
      href: '/finance/invoices',
      tone: (triplet.approvalStatus === 'APPROVED' ? 'success' : triplet.approvalStatus === 'REJECTED' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral',
    })),
    ...recentExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      timestamp: expense.approvedAt ?? expense.updatedAt,
      title: `Expense ${expense.status.toLowerCase()}`,
      detail: `${expense.description} · ${expense.approvedBy?.name ? `by ${expense.approvedBy.name}` : 'reviewed by finance'}`,
      href: `/finance/expenses?view=${expense.status === 'APPROVED' ? 'approved' : 'excluded'}`,
      tone: (expense.status === 'APPROVED' ? 'success' : 'warning') as 'success' | 'warning' | 'neutral',
    })),
    ...recentChaseNotes.map((note) => ({
      id: `chase-${note.id}`,
      timestamp: note.createdAt,
      title: 'Chase note logged',
      detail: `${note.contactedName} via ${note.method} on ${note.invoiceTriplet.invNumber ?? note.invoiceTriplet.obiNumber ?? 'invoice'} · ${note.createdByUser.name}`,
      href: '/finance/overdue',
      tone: 'neutral' as 'success' | 'warning' | 'neutral',
    })),
    ...recentCreditNotes.map((note) => ({
      id: `credit-note-${note.id}`,
      timestamp: note.createdAt,
      title: 'Credit note raised',
      detail: `${note.cnNumber} · ${formatCurrency(Number(note.amount), note.invoiceTriplet.milestone.deal.currency)} against ${note.invoiceTriplet.obiNumber ?? note.invoiceTriplet.invNumber ?? 'invoice'}`,
      href: '/finance/credit-notes',
      tone: 'warning',
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 12)

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Finance Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Live operational summary for {agency.name} finance workflows.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Xero Status</p>
          <p className={`text-sm font-bold mt-1 ${xeroConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
            {xeroConnected ? 'Connected' : 'Not connected'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link href="/finance/invoices" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Invoice Queue</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{pendingApprovals}</p>
          <p className="text-xs text-zinc-500 mt-1">Pending approvals</p>
        </Link>

        <Link href="/finance/overdue" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-amber-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Overdue Invoices</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{overdueCount}</p>
          <p className="text-xs text-zinc-500 mt-1">{formatCurrency(overdueValue, 'GBP')} outstanding</p>
        </Link>

        <Link href="/finance/payouts" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-teal-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Payout Centre</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{payoutReadyCount}</p>
          <p className="text-xs text-zinc-500 mt-1">{formatCurrency(payoutNetDue, 'GBP')} net due</p>
        </Link>

        <Link href="/finance/expenses?view=pending" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-purple-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Expense Approvals</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{pendingExpenses}</p>
          <p className="text-xs text-zinc-500 mt-1">Pending expense decisions</p>
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700 mb-3">Attention Required</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-zinc-600">Overdue follow-ups due</p>
            <p className="text-xl font-black text-zinc-900 mt-1">{followUpDueCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-zinc-600">Unapproved invoice triplets</p>
            <p className="text-xl font-black text-zinc-900 mt-1">{pendingApprovals}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-zinc-600">Xero connection health</p>
            <p className={`text-xl font-black mt-1 ${xeroConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
              {xeroConnected ? 'Healthy' : 'Needs setup'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Recent Finance Activity</h2>
          <span className="text-xs text-zinc-500">{activityItems.length} latest updates</span>
        </div>
        {activityItems.length === 0 ? (
          <p className="text-sm text-zinc-500">No recent activity yet.</p>
        ) : (
          <div className="space-y-2">
            {activityItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 hover:border-zinc-200 transition-colors"
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      item.tone === 'success'
                        ? 'text-emerald-700'
                        : item.tone === 'warning'
                          ? 'text-amber-700'
                          : 'text-zinc-800'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs text-zinc-600 truncate">{item.detail}</p>
                </div>
                <p className="text-[11px] text-zinc-500 whitespace-nowrap">{formatDateTime(item.timestamp)}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
