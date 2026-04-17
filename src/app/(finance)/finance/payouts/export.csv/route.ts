import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { buildTalentSummary, getPayoutQueue, resolveAgencyIdForUser } from '../data'

function csvEscape(value: string | number) {
  const stringValue = String(value ?? '')
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const userId = (session.user as { id?: string }).id
  const agencyId = await resolveAgencyIdForUser(userId)
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
