import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export type SheetCellType = 'string' | 'number' | 'currency' | 'date'

export type SheetColumn<Row> = {
  header: string
  type: SheetCellType
  getValue: (row: Row) => string | number | Date | null | undefined
  width?: number
  // Currency code for currency cells (e.g. 'GBP'). May be a function for per-row currency.
  currency?: string | ((row: Row) => string)
}

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function csvCell<Row>(column: SheetColumn<Row>, row: Row): string {
  const raw = column.getValue(row)
  if (raw === null || raw === undefined || raw === '') return ''
  if (raw instanceof Date) return toIsoDate(raw)
  if (column.type === 'number' || column.type === 'currency') {
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(num)) return ''
    // CSV: emit raw number with up to 2 decimals, no thousands separators.
    return column.type === 'currency' ? num.toFixed(2) : String(num)
  }
  return String(raw)
}

export function buildCsv<Row>(columns: SheetColumn<Row>[], rows: Row[]): string {
  const lines: string[] = []
  lines.push(columns.map((c) => csvEscape(c.header)).join(','))
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(csvCell(c, row))).join(','))
  }
  return lines.join('\n')
}

export async function buildXlsx<Row>(
  columns: SheetColumn<Row>[],
  rows: Row[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Therum'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(sheetName)

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width ?? Math.max(12, c.header.length + 2),
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: 'middle' }

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(rowIndex + 2)
    columns.forEach((column, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1)
      const raw = column.getValue(row)
      if (raw === null || raw === undefined || raw === '') {
        cell.value = null
        return
      }
      switch (column.type) {
        case 'number': {
          const n = typeof raw === 'number' ? raw : Number(raw)
          cell.value = Number.isFinite(n) ? n : null
          break
        }
        case 'currency': {
          const n = typeof raw === 'number' ? raw : Number(raw)
          cell.value = Number.isFinite(n) ? n : null
          const currency =
            typeof column.currency === 'function' ? column.currency(row) : column.currency ?? 'GBP'
          const symbol = currencySymbol(currency)
          cell.numFmt = `${symbol}#,##0.00`
          break
        }
        case 'date': {
          const d = raw instanceof Date ? raw : new Date(String(raw))
          cell.value = isNaN(d.getTime()) ? null : d
          cell.numFmt = 'yyyy-mm-dd'
          break
        }
        default:
          cell.value = String(raw)
      }
    })
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer as ArrayBuffer)
}

function currencySymbol(code: string): string {
  switch (code.toUpperCase()) {
    case 'GBP':
      return '£'
    case 'USD':
      return '$'
    case 'EUR':
      return '€'
    default:
      return ''
  }
}

export function csvResponse(filename: string, body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export function xlsxResponse(filename: string, body: Buffer): NextResponse {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}
