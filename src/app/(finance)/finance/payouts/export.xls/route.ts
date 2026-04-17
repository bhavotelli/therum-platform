import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { buildTalentSummary, getPayoutQueue, resolveAgencyIdForUser } from '../data'

function xmlEscape(value: string | number) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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

  const rowsXml = summary
    .map((item) => {
      const cells = [
        item.talentName,
        item.talentEmail,
        item.currency,
        item.milestoneCount,
        item.totalGross.toFixed(2),
        item.totalCommission.toFixed(2),
        item.totalNet.toFixed(2),
        today,
      ]
      return `<Row>${cells.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join('')}</Row>`
    })
    .join('')

  const headerXml = `<Row>${header.map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}</Row>`

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Payouts">
  <Table>
   ${headerXml}
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="therum-payouts-${today}.xls"`,
    },
  })
}
