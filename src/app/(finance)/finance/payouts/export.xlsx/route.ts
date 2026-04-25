import { NextResponse } from 'next/server'
import { getFinanceAgencyIdForUser } from '@/lib/financeAuth'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { buildTalentSummary, getPayoutQueue, getPendingAdjustments, type PayoutTalentSummary } from '../data'
import { buildXlsx, todayIsoDate, xlsxResponse, type SheetColumn } from '@/lib/export/sheet'

export async function GET() {
  const appUser = await resolveAppUser()
  if (!appUser) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const agencyId = await getFinanceAgencyIdForUser(appUser.id)
  if (!agencyId) {
    return new NextResponse('Agency not found', { status: 404 })
  }

  const [queue, adjustments] = await Promise.all([
    getPayoutQueue(agencyId),
    getPendingAdjustments(agencyId),
  ])
  const summary = buildTalentSummary(queue, adjustments)
  const today = todayIsoDate()

  const columns: SheetColumn<PayoutTalentSummary>[] = [
    { header: 'Talent Name', type: 'string', getValue: (r) => r.talentName, width: 28 },
    { header: 'Talent Email', type: 'string', getValue: (r) => r.talentEmail, width: 32 },
    { header: 'Currency', type: 'string', getValue: (r) => r.currency, width: 10 },
    { header: 'Milestones', type: 'number', getValue: (r) => r.milestoneCount, width: 12 },
    { header: 'Gross', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.totalGross, width: 14 },
    { header: 'Commission', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.totalCommission, width: 14 },
    { header: 'Adjustments', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.adjustmentTotal, width: 14 },
    { header: 'Net Due', type: 'currency', currency: (r) => r.currency, getValue: (r) => r.adjustedNet, width: 14 },
    { header: 'Payment Date', type: 'date', getValue: () => today, width: 14 },
  ]

  const buffer = await buildXlsx(columns, summary, 'Payouts')
  return xlsxResponse(`therum-payouts-${today}.xlsx`, buffer)
}
