import { redirect } from 'next/navigation'
import Link from 'next/link'

import { loadFinanceDashboardData } from '@/lib/finance/dashboard-data'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import { getVatMonitoringForAgency } from '@/lib/vat-monitoring'
import { VatAlertBanner } from '@/components/shared/VatAlertBanner'

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

  const db = getSupabaseServiceRole()
  const { data: agency } = await db.from('Agency').select('id, name, xeroTenantId').eq('id', financeCtx.agencyId).maybeSingle()

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

  const [vatStatuses, rawFinanceData] = await Promise.all([
    getVatMonitoringForAgency(agency.id as string),
    loadFinanceDashboardData(agency.id),
  ])
  const {
    pendingApprovals,
    pendingExpenses,
    payoutReadyCount,
    payoutReadyRows,
    approvedUnpaidTriplets,
    recentTriplets,
    recentExpenses,
    recentChaseNotes,
    recentCreditNotes,
  } = rawFinanceData as {
    pendingApprovals: number
    pendingExpenses: number
    payoutReadyCount: number
    payoutReadyRows: Record<string, unknown>[]
    approvedUnpaidTriplets: Record<string, unknown>[]
    recentTriplets: Record<string, unknown>[]
    recentExpenses: Record<string, unknown>[]
    recentChaseNotes: Record<string, unknown>[]
    recentCreditNotes: Record<string, unknown>[]
  }

  const today = new Date()
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const overdueRows = approvedUnpaidTriplets
    .map((triplet) => {
      const t = triplet as Record<string, unknown> & {
        chaseNotes?: { nextChaseDate?: Date | null }[]
      }
      const dueDate = new Date(t.invoiceDate as string)
      dueDate.setDate(dueDate.getDate() + Number(t.invDueDateDays ?? 0))
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      const daysOverdue = Math.floor((todayDateOnly.getTime() - dueDateOnly.getTime()) / 86400000)
      const latestNextChaseDate = t.chaseNotes?.[0]?.nextChaseDate ?? null
      const followUpDue =
        latestNextChaseDate !== null &&
        new Date(
          latestNextChaseDate.getFullYear(),
          latestNextChaseDate.getMonth(),
          latestNextChaseDate.getDate()
        ).getTime() <= todayDateOnly.getTime()

      return {
        ...t,
        daysOverdue,
        followUpDue,
      }
    })
    .filter((triplet) => triplet.daysOverdue > 0)

  const overdueCount = overdueRows.length
  const followUpDueCount = overdueRows.filter((row) => row.followUpDue).length
  const overdueValue = overdueRows.reduce((sum, row) => sum + Number((row as Record<string, unknown>).grossAmount), 0)
  const payoutNetDue = payoutReadyRows.reduce((sum, row) => {
    const r = row as { grossAmount?: unknown; invoiceTriplet?: { netPayoutAmount?: unknown } }
    return sum + Number(r.invoiceTriplet?.netPayoutAmount ?? r.grossAmount)
  }, 0)
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
    ...recentTriplets.map((triplet) => {
      const tr = triplet as Record<string, unknown>
      const st = String(tr.approvalStatus ?? '')
      return {
      id: `triplet-${tr.id as string}`,
      timestamp: tr.updatedAt instanceof Date ? tr.updatedAt : new Date(tr.updatedAt as string),
      title: `Invoice ${st.toLowerCase()}`,
      detail: `${tr.invNumber ?? tr.obiNumber ?? 'Invoice triplet'} moved to ${st}.`,
      href: '/finance/invoices',
      tone: (st === 'APPROVED' ? 'success' : st === 'REJECTED' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral',
    }}),
    ...recentExpenses.map((expense) => {
      const ex = expense as Record<string, unknown> & { approvedBy?: { name?: string } }
      const st = String(ex.status ?? '')
      const ts = ex.approvedAt ?? ex.updatedAt
      return {
      id: `expense-${ex.id}`,
      timestamp: ts instanceof Date ? ts : new Date(ts as string),
      title: `Expense ${st.toLowerCase()}`,
      detail: `${ex.description} · ${ex.approvedBy?.name ? `by ${ex.approvedBy.name}` : 'reviewed by finance'}`,
      href: `/finance/expenses?view=${st === 'APPROVED' ? 'approved' : 'excluded'}`,
      tone: (st === 'APPROVED' ? 'success' : 'warning') as 'success' | 'warning' | 'neutral',
    }}),
    ...recentChaseNotes.map((note) => {
      const n = note as Record<string, unknown> & {
        invoiceTriplet: { invNumber?: string | null; obiNumber?: string | null }
        createdByUser: { name: string }
      }
      return {
      id: `chase-${n.id as string}`,
      timestamp: n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt as string),
      title: 'Chase note logged',
      detail: `${n.contactedName} via ${n.method} on ${n.invoiceTriplet.invNumber ?? n.invoiceTriplet.obiNumber ?? 'invoice'} · ${n.createdByUser.name}`,
      href: '/finance/overdue',
      tone: 'neutral' as 'success' | 'warning' | 'neutral',
    }}),
    ...recentCreditNotes.map((note) => {
      const n = note as Record<string, unknown> & {
        invoiceTriplet: {
          obiNumber?: string | null
          invNumber?: string | null
          milestone: { deal: { currency: string } }
        }
      }
      return {
      id: `credit-note-${n.id as string}`,
      timestamp: n.createdAt instanceof Date ? n.createdAt : new Date(n.createdAt as string),
      title: 'Credit note raised',
      detail: `${n.cnNumber} · ${formatCurrency(Number(n.amount), n.invoiceTriplet.milestone.deal.currency)} against ${n.invoiceTriplet.obiNumber ?? n.invoiceTriplet.invNumber ?? 'invoice'}`,
      href: '/finance/credit-notes',
      tone: 'warning',
    }}),
  ]
    .sort((a, b) => (b.timestamp as Date).getTime() - (a.timestamp as Date).getTime())
    .slice(0, 12)

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{agency.name}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Finance Dashboard</h1>
            <p className="mt-0.5 text-sm text-gray-500">Live operational summary for {agency.name} finance workflows.</p>
          </div>
          <div className={`rounded-lg border px-4 py-2.5 ${xeroConnected ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Xero Status</p>
            <p className={`mt-1 text-sm font-bold ${xeroConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
              {xeroConnected ? 'Connected' : 'Not connected'}
            </p>
          </div>
        </div>
      </header>

      <VatAlertBanner statuses={vatStatuses} viewAllHref="/finance/vat-compliance" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link href="/finance/invoices" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-indigo-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Invoice Queue</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{pendingApprovals}</p>
          <p className="text-xs text-zinc-500 mt-1">Pending approvals</p>
        </Link>

        <Link href="/finance/overdue" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-amber-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Overdue Invoices</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{overdueCount}</p>
          <p className="text-xs text-zinc-500 mt-1">{formatCurrency(overdueValue, 'GBP')} outstanding</p>
        </Link>

        <Link href="/finance/payouts" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-teal-300 transition-colors">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Payout Centre</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{payoutReadyCount}</p>
          <p className="text-xs text-zinc-500 mt-1">{formatCurrency(payoutNetDue, 'GBP')} net due</p>
        </Link>

        <Link href="/finance/expenses?view=pending" className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:border-purple-300 transition-colors">
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
