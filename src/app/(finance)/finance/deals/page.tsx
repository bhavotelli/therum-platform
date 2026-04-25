import { redirect } from 'next/navigation';

import { DealNumberBadge } from '@/components/deals/DealNumberBadge';
import { loadFinanceDealsForAgency } from '@/lib/finance/deals-page-data';
import { resolveFinancePageContext } from '@/lib/financeAuth';

export const dynamic = 'force-dynamic';
type SearchParams = Promise<{ stage?: string }>;

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
  const stageFilter = params?.stage === 'all' ? 'all' : 'billing';
  const isAllView = stageFilter === 'all';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deals = (await loadFinanceDealsForAgency(agencyId)) as any[]

  const filteredDeals = isAllView
    ? deals.filter((d) => d.stage === 'ACTIVE' || d.stage === 'IN_BILLING')
    : deals.filter((d) => d.stage === 'IN_BILLING');

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">In Billing — Milestone Tracker</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Track deliverable completion and milestone approval for active deals. When a milestone is complete, it will appear in the Invoice Queue for approval.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <a
              href="/finance/deals/export.csv"
              className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Export CSV
            </a>
            <a
              href="/finance/deals/export.xlsx"
              className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Export Excel
            </a>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Deals in view</p>
            <p className="text-xl font-black text-zinc-900">{filteredDeals.length}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/finance/deals"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            !isAllView
              ? 'border-teal-300 bg-teal-50 text-teal-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          IN BILLING
        </a>
        <a
          href="/finance/deals?stage=all"
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            isAllView
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
          }`}
        >
          All active (incl. ACTIVE stage)
        </a>
      </div>

      {filteredDeals.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">
            {isAllView ? 'No active deals found.' : 'No deals in billing yet.'}
          </p>
          <p className="text-zinc-500 text-sm max-w-sm">
            {isAllView
              ? 'Active and in-billing deals will appear here once agents create records in pipeline.'
              : 'Deals move to IN BILLING when agents update the deal stage in the pipeline.'}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {deal.dealNumber && (
                          <DealNumberBadge dealNumber={deal.dealNumber} />
                        )}
                        <h2 className="text-lg font-bold text-zinc-900">{deal.title}</h2>
                      </div>
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
                          const readyForInvoice = milestone.status === 'COMPLETE' && !triplet;

                          return (
                            <tr key={milestone.id} className={`align-top ${readyForInvoice ? 'bg-emerald-50/40' : ''}`}>
                              <td className="px-4 py-3 text-zinc-800">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{milestone.description}</p>
                                  {readyForInvoice && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border border-emerald-300 bg-emerald-100 text-emerald-800">
                                      Ready for Invoice Queue
                                    </span>
                                  )}
                                </div>
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
