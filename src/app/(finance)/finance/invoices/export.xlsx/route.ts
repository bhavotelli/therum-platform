import { NextResponse } from 'next/server'
import { resolveFinancePageContext } from '@/lib/financeAuth'
import { buildXlsx, todayIsoDate, xlsxResponse } from '@/lib/export/sheet'
import { invoiceExportColumns, loadInvoiceExportRows } from '../export-data'

export async function GET() {
  const ctx = await resolveFinancePageContext()
  if (ctx.status !== 'ok') {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  const rows = await loadInvoiceExportRows(ctx.agencyId)
  const buffer = await buildXlsx(invoiceExportColumns, rows, 'Invoices')
  return xlsxResponse(`therum-invoices-${todayIsoDate()}.xlsx`, buffer)
}
