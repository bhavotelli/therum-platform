import { getSupabaseServiceRole } from "../src/lib/supabase/service"

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
  console.error("Usage: npm run verify:obi-cn -- triplet=<invoiceTripletId>")
  process.exit(1)
}

async function main() {
  const tripletId = getArg("triplet")
  if (!tripletId) usageAndExit()

  const db = getSupabaseServiceRole()

  const { data: triplet } = await db
    .from("InvoiceTriplet")
    .select("id, invoicingModel, approvalStatus, grossAmount, xeroObiId, xeroCnId, obiNumber")
    .eq("id", tripletId)
    .maybeSingle()

  if (!triplet) {
    console.error(`Triplet not found: ${tripletId}`)
    process.exit(1)
  }

  const { data: creditNotes } = await db
    .from("ManualCreditNote")
    .select("id, cnNumber, cnDate, amount, xeroCnId, createdAt")
    .eq("invoiceTripletId", tripletId)
    .order("createdAt", { ascending: true })

  const manualCreditNotes = creditNotes ?? []

  const { data: cnAuditLogs } = await db
    .from("AdminAuditLog")
    .select("id, createdAt, metadata")
    .eq("action", "OBI_CREDIT_NOTE_RAISED")
    .eq("targetType", "INVOICE_TRIPLET")
    .eq("targetId", triplet.id as string)
    .order("createdAt", { ascending: true })

  const auditList = cnAuditLogs ?? []

  const latestCn =
    manualCreditNotes.length > 0 ? manualCreditNotes[manualCreditNotes.length - 1]! : null
  const checks: CheckResult[] = [
    {
      label: "Triplet is ON_BEHALF",
      ok: triplet.invoicingModel === "ON_BEHALF",
      detail: `invoicingModel=${triplet.invoicingModel}`,
    },
    {
      label: "Triplet is approved",
      ok: triplet.approvalStatus === "APPROVED",
      detail: `approvalStatus=${triplet.approvalStatus}`,
    },
    {
      label: "OBI is pushed to Xero",
      ok: Boolean(triplet.xeroObiId),
      detail: `xeroObiId=${triplet.xeroObiId ?? "null"}`,
    },
    {
      label: "At least one CN cycle exists",
      ok: manualCreditNotes.length > 0,
      detail: `cnCycles=${manualCreditNotes.length}`,
    },
    {
      label: "All CN rows have Xero CN IDs",
      ok: manualCreditNotes.every((cn) => Boolean(cn.xeroCnId)),
      detail: `missing=${manualCreditNotes.filter((cn) => !cn.xeroCnId).length}`,
    },
    {
      label: "Audit log count matches CN cycles",
      ok: auditList.length === manualCreditNotes.length,
      detail: `audit=${auditList.length}, cn=${manualCreditNotes.length}`,
    },
    {
      label: "Triplet xeroCnId matches latest CN",
      ok:
        !latestCn ||
        String(triplet.xeroCnId ?? "") === String(latestCn.xeroCnId ?? ""),
      detail: `triplet.xeroCnId=${triplet.xeroCnId ?? "null"}, latestCn=${latestCn?.xeroCnId ?? "null"}`,
    },
  ]

  console.log("\nOBI CN Verification")
  console.log("-------------------")
  console.log(`Triplet: ${triplet.id}`)
  console.log(`Ref: ${triplet.obiNumber ?? "n/a"}`)
  console.log(`Current gross: ${Number(triplet.grossAmount).toFixed(2)}`)
  console.log(`CN cycles: ${manualCreditNotes.length}`)
  console.log("")

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.label} (${check.detail})`)
  }

  if (manualCreditNotes.length > 0) {
    console.log("\nCN History")
    console.log("----------")
    manualCreditNotes.forEach((cn, idx) => {
      const d = new Date(cn.cnDate as string)
      console.log(
        `#${idx + 1} ${cn.cnNumber} | amount=${Number(cn.amount).toFixed(2)} | date=${d.toISOString().slice(0, 10)} | xeroCnId=${cn.xeroCnId ?? "null"}`,
      )
    })
  }

  const failed = checks.filter((c) => !c.ok)
  if (failed.length > 0) {
    console.error(`\nVerification failed with ${failed.length} failing check(s).`)
    process.exit(1)
  }

  console.log("\nVerification passed.")
}

main().catch((error) => {
  console.error("Verification script failed:", error)
  process.exit(1)
})
