import prisma from '../src/lib/prisma'

type CheckResult = {
  label: string
  ok: boolean
  detail: string
}

function getArg(name: string): string | null {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (!raw) return null
  return raw.slice(name.length + 1).trim() || null
}

function usageAndExit(): never {
  console.error('Usage: npm run verify:obi-cn -- triplet=<invoiceTripletId>')
  process.exit(1)
}

async function main() {
  const tripletId = getArg('triplet')
  if (!tripletId) usageAndExit()

  try {
    const triplet = await prisma.invoiceTriplet.findUnique({
      where: { id: tripletId },
      select: {
        id: true,
        invoicingModel: true,
        approvalStatus: true,
        grossAmount: true,
        xeroObiId: true,
        xeroCnId: true,
        obiNumber: true,
        manualCreditNotes: {
          select: {
            id: true,
            cnNumber: true,
            cnDate: true,
            amount: true,
            xeroCnId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!triplet) {
      console.error(`Triplet not found: ${tripletId}`)
      process.exit(1)
    }

    const cnAuditLogs = await prisma.adminAuditLog.findMany({
      where: {
        action: 'OBI_CREDIT_NOTE_RAISED',
        targetType: 'INVOICE_TRIPLET',
        targetId: triplet.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
    })

    const latestCn = triplet.manualCreditNotes[triplet.manualCreditNotes.length - 1] ?? null
    const checks: CheckResult[] = [
      {
        label: 'Triplet is ON_BEHALF',
        ok: triplet.invoicingModel === 'ON_BEHALF',
        detail: `invoicingModel=${triplet.invoicingModel}`,
      },
      {
        label: 'Triplet is approved',
        ok: triplet.approvalStatus === 'APPROVED',
        detail: `approvalStatus=${triplet.approvalStatus}`,
      },
      {
        label: 'OBI is pushed to Xero',
        ok: Boolean(triplet.xeroObiId),
        detail: `xeroObiId=${triplet.xeroObiId ?? 'null'}`,
      },
      {
        label: 'At least one CN cycle exists',
        ok: triplet.manualCreditNotes.length > 0,
        detail: `cnCycles=${triplet.manualCreditNotes.length}`,
      },
      {
        label: 'All CN rows have Xero CN IDs',
        ok: triplet.manualCreditNotes.every((cn) => Boolean(cn.xeroCnId)),
        detail: `missing=${triplet.manualCreditNotes.filter((cn) => !cn.xeroCnId).length}`,
      },
      {
        label: 'Audit log count matches CN cycles',
        ok: cnAuditLogs.length === triplet.manualCreditNotes.length,
        detail: `audit=${cnAuditLogs.length}, cn=${triplet.manualCreditNotes.length}`,
      },
      {
        label: 'Triplet xeroCnId matches latest CN',
        ok: !latestCn || triplet.xeroCnId === latestCn.xeroCnId,
        detail: `triplet.xeroCnId=${triplet.xeroCnId ?? 'null'}, latestCn=${latestCn?.xeroCnId ?? 'null'}`,
      },
    ]

    console.log('\nOBI CN Verification')
    console.log('-------------------')
    console.log(`Triplet: ${triplet.id}`)
    console.log(`Ref: ${triplet.obiNumber ?? 'n/a'}`)
    console.log(`Current gross: ${Number(triplet.grossAmount).toFixed(2)}`)
    console.log(`CN cycles: ${triplet.manualCreditNotes.length}`)
    console.log('')

    for (const check of checks) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.label} (${check.detail})`)
    }

    if (triplet.manualCreditNotes.length > 0) {
      console.log('\nCN History')
      console.log('----------')
      triplet.manualCreditNotes.forEach((cn, idx) => {
        console.log(
          `#${idx + 1} ${cn.cnNumber} | amount=${Number(cn.amount).toFixed(2)} | date=${cn.cnDate.toISOString().slice(0, 10)} | xeroCnId=${cn.xeroCnId ?? 'null'}`
        )
      })
    }

    const failed = checks.filter((c) => !c.ok)
    if (failed.length > 0) {
      console.error(`\nVerification failed with ${failed.length} failing check(s).`)
      process.exit(1)
    }

    console.log('\nVerification passed.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error('Verification script failed:', error)
  process.exit(1)
})
