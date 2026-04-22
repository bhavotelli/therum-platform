import Link from "next/link";
import { TalentPortalData, formatCurrency } from "@/lib/talent-portal";
import { VatStatusCard } from "@/components/shared/VatAlertBanner";
import { DealNumberBadge } from "@/components/deals/DealNumberBadge";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: Date | null) {
  if (!date) return "Not synced yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function SyncBadge({ date }: { date: Date | null }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600">
      Last synced: {formatDateTime(date)}
    </div>
  );
}

function paymentState(milestone: TalentPortalData["milestones"][number]) {
  if (milestone.invoicePaidAt) {
    return {
      label: "Payment received",
      tone: "text-emerald-700 border-emerald-200 bg-emerald-50",
      date: milestone.invoicePaidAt,
    };
  }

  if (
    milestone.milestoneStatus === "INVOICED" ||
    milestone.milestoneStatus === "PAID" ||
    milestone.milestoneStatus === "PAYOUT_READY"
  ) {
    return {
      label: "Awaiting payment",
      tone: "text-amber-700 border-amber-200 bg-amber-50",
      date: null,
    };
  }

  if (milestone.milestoneStatus === "CANCELLED") {
    return {
      label: "Cancelled",
      tone: "text-rose-700 border-rose-200 bg-rose-50",
      date: null,
    };
  }

  return {
    label: "To be invoiced",
    tone: "text-zinc-700 border-zinc-200 bg-zinc-50",
    date: null,
  };
}

function deliverableSummary(milestone: TalentPortalData["milestones"][number]) {
  if (milestone.deliverables.length === 0) {
    return <p className="text-[11px] text-zinc-500">No deliverables attached</p>;
  }

  return (
    <div className="mt-1 space-y-1">
      {milestone.deliverables.slice(0, 3).map((deliverable) => (
        <div key={deliverable.id} className="text-[11px] text-zinc-600">
          <span className="font-semibold">{deliverable.title}</span>
          <span className="ml-1 text-zinc-500">
            ({deliverable.status}
            {deliverable.dueDate ? ` · due ${formatDate(deliverable.dueDate)}` : ""})
          </span>
        </div>
      ))}
      {milestone.deliverables.length > 3 && (
        <p className="text-[11px] text-zinc-500">+{milestone.deliverables.length - 3} more</p>
      )}
    </div>
  );
}

export function TalentDealsView({ data }: { data: TalentPortalData }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900">My Deals</h1>
        <SyncBadge date={data.summary.lastSyncedAt} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Deals</p>
          <p className="mt-1 text-2xl font-black text-zinc-900">{data.summary.totalDeals}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Milestones</p>
          <p className="mt-1 text-2xl font-black text-zinc-900">{data.summary.totalMilestones}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Payments Received</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">{data.summary.paymentsReceived}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Ready for Payout</p>
          <p className="mt-1 text-2xl font-black text-amber-800">{data.summary.payoutsReady}</p>
        </div>
      </div>

      {data.milestones.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-500 font-medium">No milestones yet. Your deal updates will appear here.</p>
        </div>
      ) : (
        <>
          {/*
            Mobile (< md): card layout. Horizontal-scroll tables are a pain
            on phones and the talent audience skews mobile more than
            agency/finance. Each card shows the same information in a
            vertically-stacked, tap-friendly shape.
          */}
          <div className="md:hidden space-y-3">
            {data.milestones.map((milestone) => {
              const payment = paymentState(milestone);
              return (
                <div key={milestone.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DealNumberBadge dealNumber={milestone.dealNumber} />
                      <p className="font-semibold text-zinc-900 text-sm">{milestone.dealTitle}</p>
                    </div>
                    <p className="text-xs text-zinc-500">{milestone.clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{milestone.description}</p>
                    {deliverableSummary(milestone)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-bold uppercase tracking-widest text-zinc-400">Projected Net</p>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-900">{formatCurrency(milestone.projectedNetPayoutAmount ?? 0)}</p>
                      <p className="text-[11px] text-zinc-500">
                        Gross {formatCurrency(milestone.grossAmount)} · Comm {formatCurrency(milestone.projectedCommissionAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="font-bold uppercase tracking-widest text-zinc-400">Invoice Date</p>
                      <p className="mt-0.5 text-sm font-semibold text-zinc-900">{formatDate(milestone.invoiceDate)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${payment.tone}`}>
                      {payment.label}{payment.date ? ` ${formatDate(payment.date)}` : ""}
                    </span>
                    {milestone.payoutStatus === "PAID" && (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Paid out {formatDate(milestone.payoutDate)}
                      </span>
                    )}
                    {milestone.payoutStatus === "READY" && (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Queued for payout run
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop (md+): unchanged table layout with deal number badges added */}
          <div className="hidden md:block rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Deal</th>
                    <th className="px-4 py-3 text-left font-semibold">Milestone</th>
                    <th className="px-4 py-3 text-left font-semibold">Projected Net</th>
                    <th className="px-4 py-3 text-left font-semibold">Invoice Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Payment</th>
                    <th className="px-4 py-3 text-left font-semibold">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.milestones.map((milestone) => {
                    const payment = paymentState(milestone);
                    return (
                    <tr key={milestone.id}>
                      <td className="px-4 py-3">
                        {milestone.dealNumber && (
                          <div className="mb-1">
                            <DealNumberBadge dealNumber={milestone.dealNumber} />
                          </div>
                        )}
                        <p className="font-semibold text-zinc-900">{milestone.dealTitle}</p>
                        <p className="text-xs text-zinc-500">{milestone.clientName}</p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <p className="font-medium text-zinc-800">{milestone.description}</p>
                        {deliverableSummary(milestone)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <p className="font-semibold text-zinc-900">{formatCurrency(milestone.projectedNetPayoutAmount ?? 0)}</p>
                        <p className="text-[11px] text-zinc-500">
                          Gross {formatCurrency(milestone.grossAmount)} · Comm {formatCurrency(milestone.projectedCommissionAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{formatDate(milestone.invoiceDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${payment.tone}`}>
                          {payment.label}
                        </span>
                        {payment.date ? (
                          <p className="mt-1 text-xs text-zinc-500">{formatDate(payment.date)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {milestone.payoutStatus === "PAID" ? (
                          <div>
                            <p className="font-semibold text-emerald-700">Paid out</p>
                            <p className="text-xs text-zinc-500">{formatDate(milestone.payoutDate)}</p>
                          </div>
                        ) : milestone.payoutStatus === "READY" ? (
                          <p className="font-semibold text-amber-700">Queued for payout run</p>
                        ) : (
                          <p className="text-zinc-500">Not ready</p>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TalentDashboardView({ data }: { data: TalentPortalData }) {
  const recentMilestones = [...data.milestones]
    .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-8 py-6 shadow-sm">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Quick View Dashboard</h1>
            <p className="mt-0.5 text-sm text-gray-500">Live payment and payout status snapshot.</p>
          </div>
          <div className="mt-1">
            <SyncBadge date={data.summary.lastSyncedAt} />
          </div>
        </div>
      </header>

      {/*
        Financial position first — talent cares most about "what's coming to
        me" and "what's already been paid." Promoted above the pipeline
        counts so it's the first thing above the fold on mobile.
      */}
      <section aria-labelledby="financial-heading">
        <h2 id="financial-heading" className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          Financial position
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Gross Received</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{formatCurrency(data.summary.grossReceived)}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Net Paid Out to You</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-blue-700">{formatCurrency(data.summary.netPaidOut)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Net Pending</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700">{formatCurrency(data.summary.netPending)}</p>
          </div>
        </div>
      </section>

      {/*
        Pipeline counts second — useful context but secondary to the money.
        5 cards across md+ is cramped on tablet; 2 rows of sensible widths
        (sm:3 then 2) keeps each card readable.
      */}
      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
          Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Deals</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{data.summary.totalDeals}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Milestones</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">{data.summary.totalMilestones}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Payments Received</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700">{data.summary.paymentsReceived}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">Payout Ready</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-amber-700">{data.summary.payoutsReady}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Payout Paid</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-blue-700">{data.summary.payoutsPaid}</p>
          </div>
        </div>
      </section>

      {data.vatStatus && <VatStatusCard status={data.vatStatus} />}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Recent Milestones</h2>
        {recentMilestones.length === 0 ? (
          <p className="text-sm text-gray-400">No milestone activity yet.</p>
        ) : (
          <div className="space-y-2">
            {recentMilestones.map((milestone) => {
              const payment = paymentState(milestone);
              return (
                <div key={milestone.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DealNumberBadge dealNumber={milestone.dealNumber} />
                      <p className="text-sm font-semibold text-gray-900 truncate">{milestone.description}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 truncate">{milestone.dealTitle} · {milestone.clientName}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${payment.tone}`}>
                        {payment.label}{payment.date ? ` ${formatDate(payment.date)}` : ""}
                      </span>
                      {milestone.payoutStatus === "PAID" && (
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          Paid out {formatDate(milestone.payoutDate)}
                        </span>
                      )}
                      {milestone.payoutStatus === "READY" && (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Ready for payout
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-700 tabular-nums">
                    {formatCurrency(milestone.netPayoutAmount ?? milestone.projectedNetPayoutAmount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function TalentEarningsView({ data }: { data: TalentPortalData }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900">Earnings History</h1>
        <SyncBadge date={data.summary.lastSyncedAt} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Gross Received</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">{formatCurrency(data.summary.grossReceived)}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Net Paid Out</p>
          <p className="mt-1 text-2xl font-black text-blue-800">{formatCurrency(data.summary.netPaidOut)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Net Pending</p>
          <p className="mt-1 text-2xl font-black text-amber-800">{formatCurrency(data.summary.netPending)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Upcoming Gross (To invoice)</p>
          <p className="mt-1 text-xl font-black text-zinc-900">{formatCurrency(data.summary.projectedGrossToInvoice)}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Projected Commission</p>
          <p className="mt-1 text-xl font-black text-purple-800">{formatCurrency(data.summary.projectedCommissionToInvoice)}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Projected Net Payout Due</p>
          <p className="mt-1 text-xl font-black text-indigo-800">{formatCurrency(data.summary.projectedNetToInvoice)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Milestone</th>
                <th className="px-4 py-3 text-left font-semibold">Gross</th>
                <th className="px-4 py-3 text-left font-semibold">Commission</th>
                <th className="px-4 py-3 text-left font-semibold">Net</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.milestones.map((milestone) => {
                const payment = paymentState(milestone);
                const isProjected = !milestone.invoiceRef && !milestone.commissionRef;
                return (
                <tr key={milestone.id}>
                  <td className="px-4 py-3">
                    {milestone.dealNumber && (
                      <div className="mb-1">
                        <DealNumberBadge dealNumber={milestone.dealNumber} />
                      </div>
                    )}
                    <p className="font-semibold text-zinc-900">{milestone.description}</p>
                    <p className="text-xs text-zinc-500">{milestone.dealTitle}</p>
                    {deliverableSummary(milestone)}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{formatCurrency(milestone.grossAmount)}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {formatCurrency(isProjected ? milestone.projectedCommissionAmount : milestone.commissionAmount ?? 0)}
                    {isProjected ? <p className="text-[11px] text-zinc-500">Projected</p> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-900">
                    {formatCurrency(isProjected ? milestone.projectedNetPayoutAmount : milestone.netPayoutAmount ?? 0)}
                    {isProjected ? <p className="text-[11px] text-zinc-500">Projected</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {milestone.payoutStatus === "PAID" ? (
                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Paid out
                      </span>
                    ) : milestone.payoutStatus === "READY" ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Ready for payout
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${payment.tone}`}>
                        {payment.label}
                      </span>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function TalentDocumentsView({ data }: { data: TalentPortalData }) {
  const settled = data.milestones.filter((milestone) => milestone.invoicePaidAt || milestone.payoutStatus === "PAID");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900">Documents</h1>
        <SyncBadge date={data.summary.lastSyncedAt} />
      </div>
      {settled.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-500 font-medium">Remittance statements will appear after payment events are received.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold">Deal</th>
                  <th className="px-4 py-3 text-left font-semibold">Payment Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Net Value</th>
                  <th className="px-4 py-3 text-left font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {settled.map((milestone) => (
                  <tr key={milestone.id}>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700">
                      {milestone.invoiceRef ?? milestone.commissionRef ?? `MS-${milestone.id.slice(0, 6).toUpperCase()}`}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DealNumberBadge dealNumber={milestone.dealNumber} />
                        <span>{milestone.dealTitle}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{formatDate(milestone.invoicePaidAt ?? milestone.payoutDate)}</td>
                    <td className="px-4 py-3 font-semibold text-zinc-900">{formatCurrency(milestone.netPayoutAmount ?? 0)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-600">
                        Download coming soon
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Statements update automatically from payment webhooks and payout confirmations.
      </p>
    </div>
  );
}

export function TalentProfileView({ data, homeHref = "/talent/dashboard" }: { data: TalentPortalData; homeHref?: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900">My Profile</h1>
        <SyncBadge date={data.summary.lastSyncedAt} />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Name</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{data.talent.name}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{data.talent.email}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Default Commission</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{data.talent.commissionRate}%</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">VAT Status</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{data.talent.vatRegistered ? "Registered" : "Not registered"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">VAT Number</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{data.talent.vatNumber || "Not provided"}</p>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Need a profile correction? Contact your agent so records remain synced across invoicing and payouts.
      </div>
      <Link href={homeHref} className="inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-700">
        Back to deals
      </Link>
    </div>
  );
}
