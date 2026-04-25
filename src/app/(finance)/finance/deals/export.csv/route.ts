import { NextResponse } from 'next/server'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import { buildCsv, csvResponse, todayIsoDate } from '@/lib/export/sheet'
import { dealExportColumns, loadDealExportRows } from '../export-data'

export async function GET() {
  const ctx = await resolveFinancePageContext()
  if (ctx.status !== 'ok') {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const rows = await loadDealExportRows(ctx.agencyId)
  const csv = buildCsv(dealExportColumns, rows)
  return csvResponse(`therum-deals-${todayIsoDate()}.csv`, csv)
}
