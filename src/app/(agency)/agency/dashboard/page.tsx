import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'

const STAGE_LABEL: Record<string, string> = {
  PIPELINE: 'Prospect',
  NEGOTIATING: 'Negotiating',
  CONTRACTED: 'Contracting',
  ACTIVE: 'Active',
  IN_BILLING: 'In Billing',
  COMPLETED: 'Completed',
}

export default async function AgencyDashboardPage() {
  const appUser = await resolveAppUser()
  const userId = appUser?.id
  if (!userId) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { agencyId: true, role: true },
  })
  if (!user?.agencyId) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">
        No agency linked to this user yet.
      </div>
    )
  }

  const [agency, deals, pendingTriplets, pendingDeliverables, billedAggregate, paidAggregate, recentTriplets] = await Promise.all([
    prisma.agency.findUnique({
      where: { id: user.agencyId },
      select: { name: true },
    }),
    prisma.deal.findMany({
      where: { agencyId: user.agencyId },
      select: {
        id: true,
        title: true,
        stage: true,
        probability: true,
        commissionRate: true,
        createdAt: true,
        client: { select: { name: true } },
        talent: { select: { name: true } },
        milestones: {
          select: {
            grossAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoiceTriplet.count({
      where: {
        approvalStatus: 'PENDING',
        milestone: {
          deal: {
            agencyId: user.agencyId,
          },
        },
      },
    }),
    prisma.deliverable.count({
      where: {
        status: { not: 'APPROVED' },
        milestone: {
          deal: {
            agencyId: user.agencyId,
          },
        },
      },
    }),
    prisma.invoiceTriplet.aggregate({
      where: {
        milestone: {
          deal: {
            agencyId: user.agencyId,
          },
        },
      },
      _sum: {
        grossAmount: true,
      },
    }),
    prisma.invoiceTriplet.aggregate({
      where: {
        milestone: {
          deal: {
            agencyId: user.agencyId,
          },
          status: 'PAID',
        },
      },
      _sum: {
        grossAmount: true,
      },
    }),
    prisma.invoiceTriplet.findMany({
      where: {
        milestone: {
          deal: {
            agencyId: user.agencyId,
          },
        },
      },
      select: {
        id: true,
        approvalStatus: true,
        updatedAt: true,
        invNumber: true,
        obiNumber: true,
        milestone: {
          select: {
            deal: {
              select: {
                id: true,
                title: true,
                talent: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)

  const totalGross = deals.reduce(
    (sum, deal) => sum + deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0),
    0,
  )
  const totalWeighted = deals.reduce((sum, deal) => {
    const totalDealValue = deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0)
    return sum + (totalDealValue * (deal.probability / 100))
  }, 0)
  const totalCommission = deals.reduce((sum, deal) => {
    const totalDealValue = deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0)
    return sum + (totalDealValue * (Number(deal.commissionRate) / 100))
  }, 0)
  const weightedCommission = deals.reduce((sum, deal) => {
    const totalDealValue = deal.milestones.reduce((milestoneSum, milestone) => milestoneSum + Number(milestone.grossAmount), 0)
    const weightedDealValue = totalDealValue * (deal.probability / 100)
    return sum + (weightedDealValue * (Number(deal.commissionRate) / 100))
  }, 0)
  const totalBilled = Number(billedAggregate._sum.grossAmount ?? 0)
  const totalPaid = Number(paidAggregate._sum.grossAmount ?? 0)
  const commissionRateConversion = totalGross > 0 ? Math.round((totalCommission / totalGross) * 100) : 0
  const paidConversion = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0

  const stageSummary = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.stage] = (acc[deal.stage] ?? 0) + 1
      return acc
    }, {}),
  ).sort((a, b) => a[0].localeCompare(b[0]))
  const jobsByTalent = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.talent.name] = (acc[deal.talent.name] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const jobsByClient = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      acc[deal.client.name] = (acc[deal.client.name] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  type ActivityItem = {
    id: string
    timestamp: Date
    title: string
    detail: string
    href: string
  }

  const activities: ActivityItem[] = [
    ...deals.map((d) => ({
      id: `deal-${d.id}`,
      timestamp: d.createdAt,
      title: 'New Deal Created',
      detail: `${d.title} · ${d.talent.name}`,
      href: `/agency/pipeline/${d.id}`,
    })),
    ...recentTriplets.map((t) => ({
      id: `triplet-${t.id}`,
      timestamp: t.updatedAt,
      title: `Invoice ${t.approvalStatus === 'PENDING' ? 'Generated' : t.approvalStatus}`,
      detail: `${t.invNumber || t.obiNumber || 'Draft'} · ${t.milestone.deal.title}`,
      href: `/agency/pipeline/${t.milestone.deal.id}`,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Agency Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Overview for {agency?.name ?? 'your agency'}.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Deals</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{deals.length}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Pending Invoice Approvals</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{pendingTriplets}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Pipeline Gross</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalGross)}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Weighted Pipeline</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalWeighted)}</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Commission</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalCommission)}</p>
          <p className="text-xs text-zinc-500 mt-2">{commissionRateConversion}% estimated across pipeline gross</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Weighted Commission</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(weightedCommission)}</p>
          <p className="text-xs text-zinc-500 mt-2">Probability-adjusted estimate</p>
        </div>
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Total Billed</p>
          <p className="text-3xl font-bold text-zinc-900 mt-2">{formatCurrency(totalBilled)}</p>
          <p className="text-xs text-zinc-500 mt-2">
            {paidConversion}% of billed value paid (gross: {formatCurrency(totalPaid)})
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Stage Snapshot</h2>
          <div className="space-y-2">
            {stageSummary.length === 0 ? (
              <p className="text-sm text-zinc-500">No deals yet.</p>
            ) : (
              stageSummary.map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <span className="text-sm font-medium text-zinc-700">{STAGE_LABEL[stage] ?? stage}</span>
                  <span className="text-sm font-bold text-zinc-900">{count}</span>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-3">Open deliverables pending approval: {pendingDeliverables}</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Total Jobs by Talent</h2>
          <div className="space-y-2">
            {jobsByTalent.length === 0 ? (
              <p className="text-sm text-zinc-500">No deals yet.</p>
            ) : (
              jobsByTalent.map(([talentName, count]) => (
                <div key={talentName} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-700">{talentName}</p>
                  <p className="text-sm font-bold text-zinc-900">{count}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Total Jobs by Client</h2>
          <div className="space-y-2">
            {jobsByClient.length === 0 ? (
              <p className="text-sm text-zinc-500">No deals yet.</p>
            ) : (
              jobsByClient.map(([clientName, count]) => (
                <div key={clientName} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-medium text-zinc-700">{clientName}</p>
                  <p className="text-sm font-bold text-zinc-900">{count}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {activities.map((activity) => (
              <a
                key={activity.id}
                href={activity.href}
                className="block rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-0.5">
                  <p className="text-sm font-semibold text-zinc-900">{activity.title}</p>
                  <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2">
                    {new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' }).format(activity.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 truncate">{activity.detail}</p>
              </a>
            ))}
            {activities.length === 0 ? <p className="text-sm text-zinc-500">No activity yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
