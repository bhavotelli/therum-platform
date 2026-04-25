import { NextResponse } from 'next/server'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import { buildCsv, csvResponse, todayIsoDate } from '@/lib/export/sheet'
import { invoiceExportColumns, loadInvoiceExportRows } from '../export-data'

export async function GET() {
  const ctx = await resolveFinancePageContext()
  if (ctx.status !== 'ok') {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const rows = await loadInvoiceExportRows(ctx.agencyId)
  const csv = buildCsv(invoiceExportColumns, rows)
  return csvResponse(`therum-invoices-${todayIsoDate()}.csv`, csv)
}
