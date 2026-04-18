import { getSupabaseServiceRole } from '@/lib/supabase/service'

type ContactRow = {
  id: string
  agencyId: string
  clientId: string
  name: string
  email: string
  role: string
  createdAt: string
}

function sortContacts(contacts: ContactRow[]) {
  return [...contacts].sort((a, b) => {
    const r = a.role.localeCompare(b.role)
    if (r !== 0) return r
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}

function buildMilestoneDealShape(
  milestone: Record<string, unknown>,
  dealRow: Record<string, unknown>,
  clientRow: Record<string, unknown> | undefined,
  talentRow: Record<string, unknown> | undefined,
  contactsRaw: ContactRow[],
) {
  const contacts = sortContacts(contactsRaw.filter((c) => c.clientId === dealRow.clientId))
  return {
    ...milestone,
    deal: {
      ...dealRow,
      client: { ...clientRow, contacts },
      talent: talentRow,
    },
  }
}

/** Loads invoice queue rows with the same nested shape the page expects from Prisma. */
export async function loadFinanceInvoiceQueues(agencyId: string, invoicingModel: string) {
  const db = getSupabaseServiceRole()

  const { data: deals } = await db.from('Deal').select('*').eq('agencyId', agencyId)
  const dealList = deals ?? []
  if (dealList.length === 0) {
    return {
      pendingTriplets: [] as Record<string, unknown>[],
      approvedObiTriplets: [] as Record<string, unknown>[],
      approvedTriplets: [] as Record<string, unknown>[],
      amendmentLogs: [] as { id: string; targetId: string | null; createdAt: string; actorUser?: { name: string | null } | null }[],
    }
  }

  const dealById = Object.fromEntries(dealList.map((d) => [d.id, d]))
  const dealIds = dealList.map((d) => d.id)
  const clientIds = [...new Set(dealList.map((d) => d.clientId as string))]
  const talentIds = [...new Set(dealList.map((d) => d.talentId as string))]

  const [{ data: milestones }, { data: clients }, { data: talents }, { data: allContacts }] = await Promise.all([
    db.from('Milestone').select('*').in('dealId', dealIds),
    db.from('Client').select('*').in('id', clientIds),
    db.from('Talent').select('*').in('id', talentIds),
    db.from('ClientContact').select('*').in('clientId', clientIds),
  ])

  const msById = Object.fromEntries((milestones ?? []).map((m) => [m.id, m]))
  const clientById = Object.fromEntries((clients ?? []).map((c) => [c.id, c]))
  const talentById = Object.fromEntries((talents ?? []).map((t) => [t.id, t]))
  const contactsList = (allContacts ?? []) as ContactRow[]

  const msIds = Object.keys(msById)
  if (msIds.length === 0) {
    return {
      pendingTriplets: [],
      approvedObiTriplets: [],
      approvedTriplets: [],
      amendmentLogs: [],
    }
  }

  const { data: allTriplets } = await db
    .from('InvoiceTriplet')
    .select('*')
    .in('milestoneId', msIds)
    .order('createdAt', { ascending: true })

  const triplets = allTriplets ?? []
  const tripletIds = triplets.map((t) => t.id)

  const { data: mcnRows } =
    tripletIds.length > 0
      ? await db.from('ManualCreditNote').select('invoiceTripletId, requiresReplacement').in('invoiceTripletId', tripletIds)
      : { data: [] as { invoiceTripletId: string; requiresReplacement: boolean }[] }

  const replacementSet = new Set(
    (mcnRows ?? []).filter((r) => r.requiresReplacement).map((r) => r.invoiceTripletId),
  )

  const assemble = (t: Record<string, unknown>) => {
    const ms = msById[t.milestoneId as string] as Record<string, unknown> | undefined
    if (!ms) return null
    const dealRow = dealById[ms.dealId as string] as Record<string, unknown> | undefined
    if (!dealRow) return null
    const clientRow = clientById[dealRow.clientId as string]
    const talentRow = talentById[dealRow.talentId as string]
    return {
      ...t,
      milestone: buildMilestoneDealShape(ms, dealRow, clientRow, talentRow, contactsList),
    }
  }

  const pendingTriplets = triplets
    .filter((t) => t.approvalStatus === 'PENDING')
    .map(assemble)
    .filter(Boolean) as Record<string, unknown>[]

  const baseApproved = triplets.filter(
    (t) => t.approvalStatus === 'APPROVED' && !replacementSet.has(t.id),
  )

  const { data: mcnForApproved } =
    baseApproved.length > 0
      ? await db
          .from('ManualCreditNote')
          .select('id, invoiceTripletId, cnNumber, cnDate, amount, xeroCnId, createdAt')
          .in('invoiceTripletId', baseApproved.map((x) => x.id))
          .order('createdAt', { ascending: false })
      : { data: [] as Record<string, unknown>[] }

  const mcnByTriplet = new Map<string, Record<string, unknown>[]>()
  for (const row of mcnForApproved ?? []) {
    const tid = row.invoiceTripletId as string
    const list = mcnByTriplet.get(tid) ?? []
    list.push(row)
    mcnByTriplet.set(tid, list)
  }

  const approvedTriplets = baseApproved
    .sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime())
    .slice(0, 50)
    .map((t) => {
      const row = assemble(t)
      if (!row) return null
      return row
    })
    .filter(Boolean) as Record<string, unknown>[]

  const approvedObiTriplets =
    invoicingModel === 'ON_BEHALF'
      ? (baseApproved
          .filter((t) => t.invoicingModel === 'ON_BEHALF' && t.xeroObiId)
          .sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime())
          .slice(0, 40)
          .map((t) => {
            const row = assemble(t)
            if (!row) return null
            const manualCreditNotes = mcnByTriplet.get(t.id as string) ?? []
            return { ...row, manualCreditNotes }
          })
          .filter(Boolean) as Record<string, unknown>[])
      : []

  let amendmentLogs: {
    id: string
    targetId: string | null
    createdAt: string
    actorUser?: { name: string | null } | null
  }[] = []

  if (pendingTriplets.length > 0) {
    const pendingIds = pendingTriplets.map((p) => p.id as string)
    const { data: logs } = await db
      .from('AdminAuditLog')
      .select('id, targetId, createdAt, actorUserId')
      .eq('action', 'INVOICE_DRAFT_AMENDED')
      .eq('targetType', 'INVOICE_TRIPLET')
      .in('targetId', pendingIds)
      .order('createdAt', { ascending: false })
      .limit(150)

    const actorIds = [...new Set((logs ?? []).map((l) => l.actorUserId).filter(Boolean) as string[])]
    const { data: users } =
      actorIds.length > 0 ? await db.from('User').select('id, name').in('id', actorIds) : { data: [] as { id: string; name: string }[] }
    const nameByUser = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]))

    amendmentLogs = (logs ?? []).map((l) => ({
      id: l.id as string,
      targetId: l.targetId as string | null,
      createdAt: l.createdAt as string,
      actorUser: l.actorUserId ? { name: nameByUser[l.actorUserId as string] ?? null } : null,
    }))
  }

  return { pendingTriplets, approvedObiTriplets, approvedTriplets, amendmentLogs }
}
