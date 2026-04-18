import { getSupabaseServiceRole } from '@/lib/supabase/service'

export async function loadFinanceDealsForAgency(agencyId: string) {
  const db = getSupabaseServiceRole()
  const { data: deals } = await db
    .from('Deal')
    .select('*, Client(name), Talent(name)')
    .eq('agencyId', agencyId)
    .order('updatedAt', { ascending: false })
    .limit(40)

  if (!deals?.length) return []

  const dealIds = deals.map((d) => d.id as string)
  const { data: milestones } = await db
    .from('Milestone')
    .select('*')
    .in('dealId', dealIds)
    .order('invoiceDate', { ascending: true })

  const msIds = (milestones ?? []).map((m) => m.id as string)
  if (msIds.length === 0) {
    return deals.map((deal) => {
      const d = deal as Record<string, unknown>
      return {
        ...d,
        client: (d.Client as { name: string }) ?? { name: '' },
        talent: (d.Talent as { name: string }) ?? { name: '' },
        milestones: [],
      }
    })
  }

  const [{ data: dels }, { data: triplets }] = await Promise.all([
    db.from('Deliverable').select('*').in('milestoneId', msIds).order('createdAt', { ascending: true }),
    db.from('InvoiceTriplet').select('*').in('milestoneId', msIds),
  ])

  const tripletIds = (triplets ?? []).map((t) => t.id as string)
  const { data: mcns } =
    tripletIds.length > 0
      ? await db.from('ManualCreditNote').select('*').in('invoiceTripletId', tripletIds).order('createdAt', { ascending: false })
      : { data: [] }

  const delByMs = new Map<string, Record<string, unknown>[]>()
  for (const d of dels ?? []) {
    const mid = d.milestoneId as string
    const list = delByMs.get(mid) ?? []
    list.push(d as Record<string, unknown>)
    delByMs.set(mid, list)
  }

  const tripByMs: Record<string, Record<string, unknown>> = {}
  for (const t of triplets ?? []) {
    tripByMs[t.milestoneId as string] = t as Record<string, unknown>
  }

  const mcnByTrip = new Map<string, Record<string, unknown>[]>()
  for (const m of mcns ?? []) {
    const tid = m.invoiceTripletId as string
    const list = mcnByTrip.get(tid) ?? []
    list.push(m as Record<string, unknown>)
    mcnByTrip.set(tid, list)
  }

  const msByDeal = new Map<string, Record<string, unknown>[]>()
  for (const m of milestones ?? []) {
    const did = m.dealId as string
    const list = msByDeal.get(did) ?? []
    list.push(m as Record<string, unknown>)
    msByDeal.set(did, list)
  }

  return deals.map((deal) => {
    const d = deal as Record<string, unknown> & {
      Client?: { name: string }
      Talent?: { name: string }
    }
    const msList = msByDeal.get(d.id as string) ?? []
    const milestonesBuilt = msList.map((m) => {
      const tr = tripByMs[m.id as string]
      let invoiceTriplet = null as Record<string, unknown> | null
      if (tr) {
        const notes = mcnByTrip.get(tr.id as string) ?? []
        invoiceTriplet = { ...tr, manualCreditNotes: notes }
      }
      return {
        ...m,
        deliverables: delByMs.get(m.id as string) ?? [],
        invoiceTriplet,
      }
    })

    return {
      ...d,
      client: { name: d.Client?.name ?? '' },
      talent: { name: d.Talent?.name ?? '' },
      milestones: milestonesBuilt,
    }
  })
}
