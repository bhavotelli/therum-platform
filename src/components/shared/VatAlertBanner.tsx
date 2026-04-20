import Link from 'next/link'
import type { TalentVatStatus } from '@/lib/vat-monitoring'
import { VAT_THRESHOLD } from '@/lib/vat-monitoring'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount)
}

function VatProgressBar({ status }: { status: TalentVatStatus }) {
  const barColor =
    status.band === 'red'
      ? 'bg-rose-500'
      : status.band === 'amber'
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
        <span>{formatCurrency(status.rolling12mTotal)}</span>
        <span>£{(VAT_THRESHOLD / 1000).toFixed(0)}k threshold</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${status.pctOfThreshold}%` }}
        />
      </div>
      <p className="text-[10px] text-zinc-500 mt-0.5">
        {formatCurrency(status.remainingToThreshold)} remaining to threshold
      </p>
    </div>
  )
}

export function VatAlertBanner({
  statuses,
  viewAllHref,
}: {
  statuses: TalentVatStatus[]
  viewAllHref: string
}) {
  const atRisk = statuses.filter((s) => s.band !== 'green')
  if (atRisk.length === 0) return null

  const hasRed = atRisk.some((s) => s.band === 'red')

  return (
    <section
      className={`rounded-2xl border p-5 space-y-4 ${
        hasRed
          ? 'border-rose-200 bg-rose-50/60'
          : 'border-amber-200 bg-amber-50/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-lg ${hasRed ? 'text-rose-600' : 'text-amber-600'}`}>⚠</span>
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-wider ${hasRed ? 'text-rose-900' : 'text-amber-900'}`}>
              VAT Threshold Alert
            </h2>
            <p className={`text-xs mt-0.5 ${hasRed ? 'text-rose-800' : 'text-amber-800'}`}>
              {atRisk.length} talent{atRisk.length !== 1 ? 's are' : ' is'} approaching the £90,000 VAT registration threshold in the rolling 12 months.
            </p>
          </div>
        </div>
        <Link
          href={viewAllHref}
          className={`shrink-0 inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            hasRed
              ? 'border-rose-300 bg-white text-rose-700 hover:bg-rose-50'
              : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50'
          }`}
        >
          View full report →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {atRisk.slice(0, 6).map((status) => (
          <div
            key={status.talentId}
            className={`rounded-xl border bg-white p-3 space-y-2 ${
              status.band === 'red' ? 'border-rose-200' : 'border-amber-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-900 truncate">{status.talentName}</p>
                <p className="text-[10px] text-zinc-500 truncate">{status.talentEmail}</p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  status.band === 'red'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {status.band === 'red' ? 'Register ASAP' : 'Speak to accountant'}
              </span>
            </div>
            <VatProgressBar status={status} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function VatStatusCard({ status }: { status: TalentVatStatus }) {
  const config = {
    green: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/60',
      title: 'text-emerald-900',
      sub: 'text-emerald-800',
      label: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      badge: 'Well within threshold',
      message: 'Your rolling 12-month earnings are well within the UK VAT registration threshold.',
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50/60',
      title: 'text-amber-900',
      sub: 'text-amber-800',
      label: 'border-amber-200 bg-amber-50 text-amber-700',
      badge: 'Approaching threshold',
      message: 'You are approaching the VAT threshold. Speak to your accountant about VAT registration.',
    },
    red: {
      border: 'border-rose-200',
      bg: 'bg-rose-50/60',
      title: 'text-rose-900',
      sub: 'text-rose-800',
      label: 'border-rose-200 bg-rose-50 text-rose-700',
      badge: 'Register ASAP',
      message: 'You are close to the £90,000 VAT threshold. You should register for VAT immediately.',
    },
  }[status.band]

  return (
    <section className={`rounded-2xl border p-5 space-y-3 ${config.border} ${config.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wider ${config.title}`}>VAT Threshold Monitor</h2>
          <p className={`text-xs mt-1 ${config.sub}`}>{config.message}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${config.label}`}>
          {config.badge}
        </span>
      </div>
      <div className="rounded-xl border border-white/80 bg-white p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Rolling 12-month earnings (invoiced)</p>
        <VatProgressBar status={status} />
      </div>
    </section>
  )
}
