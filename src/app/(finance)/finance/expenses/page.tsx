import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import { approveExpense, rejectExpense } from './actions'

export const dynamic = 'force-dynamic'
type SearchParams = Promise<{ view?: string }>

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount)
}

export default async function ExpenseApprovalsPage(props: { searchParams?: SearchParams }) {
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
        <h1 className="text-2xl font-bold text-zinc-900">Expense Approvals</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-sm">
            Link this finance account to an agency to unlock expense approvals.
          </p>
        </div>
      </div>
    )
  }

  const { agencyId } = financeCtx

  const params = props.searchParams ? await props.searchParams : undefined
  const view = params?.view === 'approved' || params?.view === 'excluded' ? params.view : 'pending'
  const statusMap = {
    pending: 'PENDING',
    approved: 'APPROVED',
    excluded: 'EXCLUDED',
  } as const
  const selectedStatus = statusMap[view]

  const [expenses, pendingCount, approvedCount, excludedCount] = await Promise.all([
    prisma.dealExpense.findMany({
      where: {
        agencyId,
        status: selectedStatus,
      },
      include: {
        deal: {
          select: {
            id: true,
            title: true,
          },
        },
        milestone: {
          select: {
            id: true,
            description: true,
          },
        },
        approvedBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.dealExpense.count({ where: { agencyId, status: 'PENDING' } }),
    prisma.dealExpense.count({ where: { agencyId, status: 'APPROVED' } }),
    prisma.dealExpense.count({ where: { agencyId, status: 'EXCLUDED' } }),
  ])

  const pendingExpenses = expenses
  const totalPendingAmount = pendingExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const warningCount = pendingExpenses.filter((expense) => expense.rechargeable && !expense.contractSignOff).length

  const viewLabel =
    view === 'pending'
      ? 'pending'
      : view === 'approved'
        ? 'approved'
        : 'excluded'

  const emptyTitle =
    view === 'pending'
      ? 'No pending expenses.'
      : view === 'approved'
        ? 'No approved expenses yet.'
        : 'No excluded expenses yet.'

  const emptyDescription =
    view === 'pending'
      ? 'New expenses awaiting finance review will appear here.'
      : view === 'approved'
        ? 'Approved expenses will appear here for audit and reconciliation.'
        : 'Excluded expenses will appear here for historical review.'

  const isPendingView = view === 'pending'

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Expense Approvals</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Review {viewLabel} expenses and confirm what is billable, contract-cleared, or excluded.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Pending expenses</p>
            <p className="text-xl font-black text-zinc-900">{pendingCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Approved</p>
            <p className="text-xl font-black text-zinc-900">{approvedCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Excluded</p>
            <p className="text-xl font-black text-zinc-900">{excludedCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">View value</p>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(totalPendingAmount, 'GBP')}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/finance/expenses?view=pending"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'pending'
              ? 'border-teal-300 bg-teal-50 text-teal-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Pending
        </a>
        <a
          href="/finance/expenses?view=approved"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'approved'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Approved
        </a>
        <a
          href="/finance/expenses?view=excluded"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            view === 'excluded'
              ? 'border-rose-300 bg-rose-50 text-rose-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Excluded
        </a>
      </div>

      {isPendingView && warningCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {warningCount} rechargeable expense{warningCount === 1 ? '' : 's'} missing contract sign-off. Review carefully before approval.
        </div>
      )}

      {pendingExpenses.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">{emptyTitle}</p>
          <p className="text-zinc-500 text-sm max-w-sm">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Deal / Milestone</th>
                  <th className="px-4 py-3 text-left font-semibold">Expense</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Flags</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-center font-semibold">{isPendingView ? 'Actions' : 'Review'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {pendingExpenses.map((expense) => {
                  const hasWarning = expense.rechargeable && !expense.contractSignOff

                  return (
                    <tr key={expense.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-zinc-900">{expense.deal.title}</p>
                        <p className="text-xs text-zinc-500 mt-1">{expense.milestone?.description ?? 'Deal-level expense'}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <p className="font-medium text-zinc-800">{expense.description}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Incurred by: {expense.incurredBy} · VAT: {expense.vatApplicable ? 'Yes' : 'No'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{expense.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${expense.rechargeable ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
                            {expense.rechargeable ? 'Rechargeable' : 'Non-rechargeable'}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${expense.contractSignOff ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {expense.contractSignOff ? 'Contract signed off' : 'No contract sign-off'}
                          </span>
                          {hasWarning && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold bg-rose-50 text-rose-700 border-rose-200">
                              Approval warning
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                        {formatCurrency(Number(expense.amount), expense.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {isPendingView ? (
                          <div className="flex items-center justify-center gap-2">
                            <form action={approveExpense.bind(null, expense.id)}>
                              <button
                                type="submit"
                                className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-600 hover:text-white hover:border-emerald-700 transition-colors"
                              >
                                Approve
                              </button>
                            </form>
                            <form action={rejectExpense.bind(null, expense.id)}>
                              <button
                                type="submit"
                                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors"
                              >
                                Exclude
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${
                                view === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {view === 'approved' ? 'Approved' : 'Excluded'}
                            </span>
                            {expense.approvedBy?.name && (
                              <p className="text-[11px] text-zinc-500 mt-1">by {expense.approvedBy.name}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
