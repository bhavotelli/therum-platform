import { NextResponse } from 'next/server'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import { buildXlsx, todayIsoDate, xlsxResponse } from '@/lib/export/sheet'
import { dealExportColumns, loadDealExportRows } from '../export-data'

export async function GET() {
  const ctx = await resolveFinancePageContext()
  if (ctx.status !== 'ok') {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const rows = await loadDealExportRows(ctx.agencyId)
  const buffer = await buildXlsx(dealExportColumns, rows, 'Deals')
  return xlsxResponse(`therum-deals-${todayIsoDate()}.xlsx`, buffer)
}
