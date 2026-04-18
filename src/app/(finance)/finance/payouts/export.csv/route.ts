import { NextResponse } from 'next/server'
import { getFinanceAgencyIdForUser } from '@/lib/financeAuth'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { buildTalentSummary, getPayoutQueue } from '../data'

function csvEscape(value: string | number) {
  const stringValue = String(value ?? '')
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function GET() {
  const appUser = await resolveAppUser()
  if (!appUser) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const userId = appUser.id
  const agencyId = await getFinanceAgencyIdForUser(userId)
  if (!agencyId) {
    return new NextResponse('Agency not found', { status: 404 })
  }

  const queue = await getPayoutQueue(agencyId)
  const summary = buildTalentSummary(queue)
  const today = new Date().toISOString().slice(0, 10)

  const header = [
    'talent_name',
    'talent_email',
    'currency',
    'milestones_count',
    'gross_total',
    'commission_total',
    'net_due',
    'payment_date',
  ]

  const rows = summary.map((item) => [
    item.talentName,
    item.talentEmail,
    item.currency,
    item.milestoneCount,
    item.totalGross.toFixed(2),
    item.totalCommission.toFixed(2),
    item.totalNet.toFixed(2),
    today,
  ])

  const csv = [header, ...rows]
    .map((line) => line.map((cell) => csvEscape(cell)).join(','))
    .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="therum-payouts-${today}.csv"`,
    },
  })
}
