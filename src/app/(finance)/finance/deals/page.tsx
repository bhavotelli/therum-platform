import { redirect } from 'next/navigation';

import { loadFinanceDealsForAgency } from '@/lib/finance/deals-page-data';
import { resolveFinancePageContext } from '@/lib/financeAuth';

export const dynamic = 'force-dynamic';
type SearchParams = Promise<{ view?: string }>;

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'GBP',
  }).format(amount);
}

function formatDate(value: Date | string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function statusPillClass(status: string) {
  if (status === 'PAID' || status === 'READY' || status === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'INVOICED' || status === 'PAYOUT_READY') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'COMPLETE') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default async function FinanceDealsPage(props: { searchParams?: SearchParams }) {
  const financeCtx = await resolveFinancePageContext();
  if (financeCtx.status === 'need_login') {
    redirect('/login');
  }
  if (financeCtx.status === 'need_impersonation') {
    redirect(
      '/admin?notice=' +
        encodeURIComponent('Choose an agency in the Super Admin bar to view finance for that tenant.'),
    );
  }
  if (financeCtx.status === 'need_agency') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900">Deals (Read-only)</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-sm">
            Link this finance account to an agency to unlock deal visibility.
          </p>
        </div>
      </div>
    );
  }

  const { agencyId } = financeCtx;

  const params = props.searchParams ? await props.searchParams : undefined;
  const view = params?.view === 'actionable' ? 'actionable' : 'all';
  const actionableStatuses = new Set(['COMPLETE', 'INVOICED', 'PAID', 'PAYOUT_READY']);
  const isActionableView = view === 'actionable';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (await loadFinanceDealsForAgency(agencyId)) as any[]

  const filteredDeals = deals
    .map((deal) => {
      const filteredMilestones = isActionableView
        ? deal.milestones.filter((milestone: { status: string }) => actionableStatuses.has(milestone.status))
        : deal.milestones;

      return {
        ...deal,
        milestones: filteredMilestones,
      };
    })
    .filter((deal) => !isActionableView || deal.milestones.length > 0);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Deals (Read-only)</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Finance visibility across deals, milestones, and invoice progression. No edit controls are available here.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Deals in view</p>
          <p className="text-xl font-black text-zinc-900">{filteredDeals.length}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/finance/deals"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            !isActionableView
              ? 'border-teal-300 bg-teal-50 text-teal-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          All milestones
        </a>
        <a
          href="/finance/deals?view=actionable"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            isActionableView
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          Completed / Invoice-ready only
        </a>
      </div>

      {filteredDeals.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">
            {isActionableView ? 'No completed milestones found.' : 'No deals available yet.'}
          </p>
          <p className="text-zinc-500 text-sm max-w-sm">
            {isActionableView
              ? 'Switch to "All milestones" to view full deal records, including pending milestones.'
              : 'Deals will appear here once agents create records in pipeline.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredDeals.map((deal) => {
            const milestonesCompleted = deal.milestones.filter(
              (m: { status: string }) => m.status === 'COMPLETE' || m.status === 'INVOICED' || m.status === 'PAID' || m.status === 'PAYOUT_READY'
            ).length;

            return (
              <section id={`deal-${deal.id}`} key={deal.id} className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900">{deal.title}</h2>
                      <p className="text-sm text-zinc-500 mt-1">
                        {deal.client.name} · {deal.talent.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border bg-zinc-50 text-zinc-700 border-zinc-200">
                        {deal.stage}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                        Milestones {milestonesCompleted}/{deal.milestones.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Milestone</th>
                        <th className="px-4 py-3 text-left font-semibold">Invoice Date</th>
                        <th className="px-4 py-3 text-right font-semibold">Gross</th>
                        <th className="px-4 py-3 text-left font-semibold">Milestone Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Payout</th>
                        <th className="px-4 py-3 text-left font-semibold">Invoice Flow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {deal.milestones.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                            No milestones on this deal yet.
                          </td>
                        </tr>
                      ) : (
                        deal.milestones.map((milestone: Record<string, any>) => {
                          const triplet = milestone.invoiceTriplet;
                          const invoiceRef = triplet?.invNumber ?? triplet?.obiNumber ?? '—';
                          const billingRef = triplet?.sbiNumber ?? triplet?.cnNumber ?? '—';
                          const latestCreditNote = triplet?.manualCreditNotes?.[0];

                          return (
                            <tr key={milestone.id} className="align-top">
                              <td className="px-4 py-3 text-zinc-800">
                                <p className="font-medium">{milestone.description}</p>
                                <p className="text-xs text-zinc-500 mt-1">
                                  Delivery due: {formatDate(milestone.deliveryDueDate)}
                                </p>
                                <div className="mt-2 space-y-1">
                                  {milestone.deliverables.length === 0 ? (
                                    <p className="text-xs text-zinc-500">No deliverables attached.</p>
                                  ) : (
                                    milestone.deliverables.map((deliverable: { id: string; title: string; dueDate?: string | null; status: string }) => (
                                      <div key={deliverable.id} className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
                                        <p className="text-xs text-zinc-700 truncate">
                                          {deliverable.title}
                                          {deliverable.dueDate ? ` · due ${formatDate(deliverable.dueDate)}` : ''}
                                        </p>
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusPillClass(deliverable.status)}`}>
                                          {deliverable.status}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-zinc-700">{formatDate(milestone.invoiceDate)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                                {formatCurrency(Number(milestone.grossAmount), deal.currency)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${statusPillClass(milestone.status)}`}>
                                  {milestone.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${statusPillClass(milestone.payoutStatus)}`}>
                                  {milestone.payoutStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {!triplet ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border bg-zinc-50 text-zinc-600 border-zinc-200">
                                    Not generated
                                  </span>
                                ) : (
                                  <div className="space-y-1 text-xs text-zinc-600">
                                    <p>INV/OBI: <span className="font-semibold text-zinc-800">{invoiceRef}</span></p>
                                    <p>SBI/CN: <span className="font-semibold text-zinc-800">{billingRef}</span></p>
                                    <p>COM: <span className="font-semibold text-zinc-800">{triplet.comNumber}</span></p>
                                    {latestCreditNote ? (
                                      <p>
                                        CN Raised:{' '}
                                        <span className="font-semibold text-zinc-800">
                                          {latestCreditNote.cnNumber}
                                        </span>
                                        {' · '}
                                        {formatCurrency(Number(latestCreditNote.amount), deal.currency)}
                                      </p>
                                    ) : null}
                                    {triplet.xeroCnId ? (
                                      <p>CN pushed to Xero: <span className="font-semibold text-zinc-800">Yes</span></p>
                                    ) : null}
                                    <p>
                                      Approval:{' '}
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${statusPillClass(triplet.approvalStatus)}`}>
                                        {triplet.approvalStatus}
                                      </span>
                                    </p>
                                    <p>Paid in Xero: {formatDate(triplet.invPaidAt)}</p>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
