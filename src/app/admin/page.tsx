import SignOutButton from '@/components/layout/SignOutButton'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { getSupabaseServiceRole } from '@/lib/supabase/service'
import type { UserRole } from '@/types/database'
import { UserRoles } from '@/types/database'
import { addAgencyUser, createAgency, resendInvite, resetUserPassword, startImpersonationSession, toggleAgencyActive, toggleUserActive, updateUserRole } from './actions'

type AdminAuditLogRecord = {
  id: string
  action: string
  targetType: string
  targetId: string | null
  createdAt: Date
}

type AdminDashboardUser = {
  id: string
  email: string
  role: UserRole
  active: boolean
  authLinked: boolean
  agency: {
    name: string
  } | null
}

type PreviewLogRecord = {
  id: string
  startedAt: Date
  agencyId: string
  talentId: string
  previewedBy: string
  agency: { name: string } | null
  talent: { name: string } | null
  previewer: { email: string; role: UserRole } | null
}

type PreviewLogFilters = {
  agencyId?: string
  previewedBy?: string
  talentId?: string
  days?: number
}

async function getRecentAdminAuditLogs(): Promise<AdminAuditLogRecord[]> {
  try {
    const db = getSupabaseServiceRole()
    const { data } = await db.from('AdminAuditLog').select('id, action, targetType, targetId, createdAt').order('createdAt', { ascending: false }).limit(15)
    return (data ?? []) as AdminAuditLogRecord[]
  } catch {
    return []
  }
}

type AgencyForAdmin = {
  id: string
  name: string
  slug: string
  active: boolean
  invoicingModel: string
  xeroTenantId: string | null
  updatedAt: string
  users: { id: string; email: string; role: UserRole }[]
  _count: { users: number; deals: number }
}

async function getAgenciesForAdmin(): Promise<AgencyForAdmin[]> {
  const db = getSupabaseServiceRole()
  const { data: agencies } = await db.from('Agency').select('*').order('createdAt', { ascending: false })
  if (!agencies?.length) return []

  const ids = agencies.map((a) => a.id)
  const [{ data: deals }, { data: users }] = await Promise.all([
    db.from('Deal').select('agencyId').in('agencyId', ids),
    db.from('User').select('id, email, role, agencyId, createdAt').in('agencyId', ids).order('createdAt', { ascending: false }),
  ])

  const dealCount = new Map<string, number>()
  for (const d of deals ?? []) {
    const aid = d.agencyId as string
    dealCount.set(aid, (dealCount.get(aid) ?? 0) + 1)
  }

  const usersByAgency = new Map<string, typeof users>()
  for (const u of users ?? []) {
    const aid = u.agencyId as string
    const list = usersByAgency.get(aid) ?? []
    list.push(u)
    usersByAgency.set(aid, list)
  }

  return agencies.map((a) => {
    const allU = usersByAgency.get(a.id) ?? []
    return {
      id: a.id,
      name: a.name as string,
      slug: a.slug as string,
      active: a.active as boolean,
      invoicingModel: a.invoicingModel as string,
      xeroTenantId: (a.xeroTenantId as string | null) ?? null,
      updatedAt: a.updatedAt as string,
      users: allU.slice(0, 3).map((u) => ({ id: u.id, email: u.email as string, role: u.role as UserRole })),
      _count: { users: allU.length, deals: dealCount.get(a.id) ?? 0 },
    }
  })
}

async function getRecentPreviewLogs(filters: PreviewLogFilters): Promise<PreviewLogRecord[]> {
  try {
    const db = getSupabaseServiceRole()
    let q = db
      .from('PreviewLog')
      .select('id, startedAt, agencyId, talentId, previewedBy')
      .order('startedAt', { ascending: false })
      .limit(100)

    if (filters.agencyId) q = q.eq('agencyId', filters.agencyId)
    if (filters.previewedBy) q = q.eq('previewedBy', filters.previewedBy)
    if (filters.talentId) q = q.eq('talentId', filters.talentId)
    if (filters.days && filters.days > 0) {
      const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString()
      q = q.gte('startedAt', since)
    }

    const { data: logs } = await q
    if (!logs?.length) return []

    const agencyIds = [...new Set(logs.map((l) => l.agencyId as string))]
    const talentIds = [...new Set(logs.map((l) => l.talentId as string))]
    const userIds = [...new Set(logs.map((l) => l.previewedBy as string))]

    const [{ data: agRows }, { data: talRows }, { data: usrRows }] = await Promise.all([
      db.from('Agency').select('id, name').in('id', agencyIds),
      db.from('Talent').select('id, name').in('id', talentIds),
      db.from('User').select('id, email, role').in('id', userIds),
    ])

    const agMap = Object.fromEntries((agRows ?? []).map((r) => [r.id, r.name]))
    const talMap = Object.fromEntries((talRows ?? []).map((r) => [r.id, r.name]))
    const usrMap = Object.fromEntries((usrRows ?? []).map((r) => [r.id, { email: r.email, role: r.role as UserRole }]))

    return logs.map((log) => ({
      id: log.id as string,
      startedAt: new Date(log.startedAt as string),
      agencyId: log.agencyId as string,
      talentId: log.talentId as string,
      previewedBy: log.previewedBy as string,
      agency: { name: agMap[log.agencyId as string] ?? null },
      talent: { name: talMap[log.talentId as string] ?? null },
      previewer: usrMap[log.previewedBy as string] ? { ...usrMap[log.previewedBy as string] } : null,
    }))
  } catch {
    return []
  }
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams?: Promise<{
    agencyId?: string
    notice?: string
    error?: string
    /** Safe path to return after an action error (e.g. Super Admin toolbar switch failed). */
    returnTo?: string
    actionLink?: string
    actionLabel?: string
    previewAgencyId?: string
    previewUserId?: string
    previewTalentId?: string
    previewDays?: string
  }>
}) {
  await requireSuperAdmin()

  const params = searchParams ? await searchParams : undefined
  const selectedAgencyId = params?.agencyId ?? ''
  const notice = params?.notice
  const error = params?.error
  const returnToRaw = params?.returnTo ?? ''
  const returnToHref =
    returnToRaw.startsWith('/') && !returnToRaw.startsWith('//') ? returnToRaw : ''
  const actionLink = params?.actionLink
  const actionLabel = params?.actionLabel
  const previewAgencyId = params?.previewAgencyId ?? ''
  const previewUserId = params?.previewUserId ?? ''
  const previewTalentId = params?.previewTalentId ?? ''
  const previewDaysRaw = Number(params?.previewDays ?? '7')
  const previewDays = [0, 1, 7, 30, 90].includes(previewDaysRaw) ? previewDaysRaw : 7

  const db = getSupabaseServiceRole()
  const [agencies, users, totalDeals, totalInvoicesPushed, auditLogs, previewLogs, previewUsers, previewTalents] = await Promise.all([
    getAgenciesForAdmin(),
    (async () => {
      let uq = db
        .from('User')
        .select('id, email, role, active, agencyId, authUserId')
        .neq('role', UserRoles.SUPER_ADMIN)
        .order('createdAt', { ascending: false })
        .limit(50)
      if (selectedAgencyId) uq = uq.eq('agencyId', selectedAgencyId)
      const { data: userRows } = await uq
      const aids = [...new Set((userRows ?? []).map((u) => u.agencyId).filter(Boolean))] as string[]
      const { data: agNames } = aids.length ? await db.from('Agency').select('id, name').in('id', aids) : { data: [] }
      const nm = Object.fromEntries((agNames ?? []).map((a) => [a.id, a.name as string]))
      return (userRows ?? []).map((u) => ({
        id: u.id as string,
        email: u.email as string,
        role: u.role as UserRole,
        active: u.active as boolean,
        authLinked: Boolean((u as { authUserId?: string | null }).authUserId),
        agency: u.agencyId ? { name: nm[u.agencyId as string] ?? '' } : null,
      })) as AdminDashboardUser[]
    })(),
    db.from('Deal').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    db.from('InvoiceTriplet').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    getRecentAdminAuditLogs(),
    getRecentPreviewLogs({
      agencyId: previewAgencyId || undefined,
      previewedBy: previewUserId || undefined,
      talentId: previewTalentId || undefined,
      days: previewDays === 0 ? undefined : previewDays,
    }),
    db
      .from('User')
      .select('id, email')
      .in('role', [UserRoles.SUPER_ADMIN, UserRoles.AGENCY_ADMIN, UserRoles.AGENT])
      .order('email', { ascending: true })
      .limit(200)
      .then((r) => r.data ?? []),
    (async () => {
      let tq = db.from('Talent').select('id, name').order('name', { ascending: true }).limit(200)
      if (previewAgencyId) tq = tq.eq('agencyId', previewAgencyId)
      const { data } = await tq
      return data ?? []
    })(),
  ])

  const buttonPrimary = 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors'
  const buttonSecondary = 'rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors'
  const buttonWarning = 'rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors'
  const buttonDanger = 'rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors'
  const buttonInfo = 'rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors'
  const buttonAccent = 'rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors'

  return (
    <div className="min-h-screen bg-[#0D1526] text-white p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Super Admin Control</h1>
              <p className="text-zinc-400 mt-2 font-medium">Agency creation, user management, and platform health.</p>
            </div>
            <div className="flex items-center gap-2">
              <SignOutButton
                className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-300 transition hover:border-red-300/30 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                toastClassName="border-red-300/50 bg-red-500/15 text-red-200"
              />
            </div>
          </div>
        </header>

        {notice && (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
            <div>{notice}</div>
            {actionLink && actionLabel && (
              <a
                href={actionLink}
                className="mt-2 inline-block rounded bg-emerald-700/40 px-2 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-700/60"
              >
                {actionLabel}
              </a>
            )}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">
            <p>{error}</p>
            {returnToHref ? (
              <a
                href={returnToHref}
                className="mt-3 inline-block rounded-lg bg-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-800/50"
              >
                Back to previous page
              </a>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Agencies</h3>
            <p className="text-4xl font-black text-blue-500">{agencies.length}</p>
          </div>
          <div className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">
              {selectedAgencyId ? 'Active Users (Filtered)' : 'Active Users'}
            </h3>
            <p className="text-4xl font-black text-green-500">{users.filter((user: { active: boolean }) => user.active).length}</p>
          </div>
          <div className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Total Deals</h3>
            <p className="text-4xl font-black text-purple-500">{totalDeals}</p>
          </div>
          <div className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Invoices Pushed</h3>
            <p className="text-4xl font-black text-cyan-500">{totalInvoicesPushed}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-300 mb-4">Create Agency</h2>
            <form action={createAgency} className="space-y-3">
              <input name="name" placeholder="Agency name" className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm" required />
              <input name="primaryContactEmail" type="email" placeholder="Primary contact email" className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm" required />
              <select name="invoicingModel" className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm">
                <option value="SELF_BILLING">SELF_BILLING</option>
                <option value="ON_BEHALF">ON_BEHALF</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" name="vatRegistered" className="accent-red-500" />
                VAT registered
              </label>
              <button type="submit" className="rounded-xl bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold">
                Create Agency + Admin User
              </button>
            </form>
          </section>

          <section className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-300 mb-4">Add Agency User</h2>
            <form action={addAgencyUser} className="space-y-3">
              <select name="agencyId" className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm" required>
                <option value="">Select agency</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
              <input name="email" type="email" placeholder="User email" className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm" required />
              <select name="role" className="w-full rounded-xl bg-[#0D1526] border border-white/10 px-3 py-2 text-sm">
                <option value="AGENCY_ADMIN">AGENCY_ADMIN</option>
                <option value="AGENT">AGENT</option>
                <option value="FINANCE">FINANCE</option>
                <option value="TALENT">TALENT</option>
              </select>
              <button type="submit" className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm font-semibold">
                Create User Invite
              </button>
            </form>
          </section>
        </div>

        <section className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4">Admin Audit Log</h2>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">No audit events yet.</p>
            ) : (
              auditLogs.map((log: AdminAuditLogRecord) => (
                <div key={log.id} className="rounded-lg border border-white/10 bg-[#0D1526] p-3">
                  <p className="text-xs font-semibold text-zinc-200">{log.action}</p>
                  <p className="text-xs text-zinc-400">
                    {log.targetType}{log.targetId ? ` · ${log.targetId}` : ''} · {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4">Talent Preview Log</h2>
          <form method="get" className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input type="hidden" name="agencyId" value={selectedAgencyId} />
            <select
              name="previewAgencyId"
              defaultValue={previewAgencyId}
              className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
            >
              <option value="">All agencies</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
            <select
              name="previewUserId"
              defaultValue={previewUserId}
              className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
            >
              <option value="">All preview users</option>
              {previewUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
            <select
              name="previewTalentId"
              defaultValue={previewTalentId}
              className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
            >
              <option value="">All talent</option>
              {previewTalents.map((talent) => (
                <option key={talent.id} value={talent.id}>
                  {talent.name}
                </option>
              ))}
            </select>
            <select
              name="previewDays"
              defaultValue={String(previewDays)}
              className="rounded bg-white/10 border border-white/20 px-2 py-1.5 text-xs"
            >
              <option value="1">Last 24h</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="0">All time</option>
            </select>
            <div className="sm:col-span-4 flex items-center gap-2">
              <button type="submit" className={buttonPrimary}>
                Apply Preview Filters
              </button>
              <a
                href={`/admin?agencyId=${selectedAgencyId}`}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition-colors"
              >
                Clear Preview Filters
              </a>
            </div>
          </form>
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {previewLogs.length === 0 ? (
              <p className="text-sm text-zinc-500">No preview events yet.</p>
            ) : (
              previewLogs.map((log: PreviewLogRecord) => (
                <div key={log.id} className="rounded-lg border border-white/10 bg-[#0D1526] p-3">
                  <p className="text-xs font-semibold text-zinc-200">
                    {log.previewer?.email ?? 'Unknown user'} previewed {log.talent?.name ?? 'Unknown talent'}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {log.agency?.name ?? log.agencyId} · {new Date(log.startedAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4">Agency Detail</h2>
            {agencies.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#0D1526] p-5 text-sm text-zinc-400">
                No agencies yet. Create your first agency using the form above to get started.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {agencies.map((agency) => (
                <div key={agency.id} className="rounded-xl border border-white/10 p-4 bg-[#0D1526]">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{agency.name}</p>
                    <span className={`text-xs font-semibold ${agency.active ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {agency.active ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {agency.slug} · {agency.invoicingModel}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-white/5 p-2">Users: {agency._count.users}</div>
                    <div className="rounded bg-white/5 p-2">Deals: {agency._count.deals}</div>
                    <div className={`rounded p-2 ${agency.xeroTenantId ? 'bg-teal-900/40 text-teal-300' : 'bg-white/5 text-zinc-400'}`}>
                      {agency.xeroTenantId ? 'Xero Connected' : 'Xero Not Linked'}
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">Updated {new Date(agency.updatedAt).toLocaleString()}</p>
                  <div className="mt-3 space-y-1">
                    {agency.users.length === 0 ? (
                      <p className="text-xs text-zinc-500">No users yet.</p>
                    ) : (
                      agency.users.map((agencyUser: { id: string; email: string; role: UserRole }) => (
                        <p key={agencyUser.id} className="text-xs text-zinc-300">
                          {agencyUser.email} <span className="text-zinc-500">({agencyUser.role})</span>
                        </p>
                      ))
                    )}
                    {agency._count.users > agency.users.length && (
                      <p className="text-xs text-zinc-500">+{agency._count.users - agency.users.length} more users</p>
                    )}
                  </div>
                  <a
                    href={`/admin?agencyId=${agency.id}`}
                    className={`mt-3 inline-block ${buttonPrimary}`}
                  >
                    View Users
                  </a>
                  <form action={toggleAgencyActive} className="mt-3">
                    <input type="hidden" name="agencyId" value={agency.id} />
                    <input type="hidden" name="currentValue" value={String(agency.active)} />
                    <button
                      type="submit"
                      className={agency.active ? buttonDanger : buttonWarning}
                    >
                      {agency.active ? 'Deactivate Agency' : 'Reactivate Agency'}
                    </button>
                  </form>
                  <form action={startImpersonationSession} className="mt-2">
                    <input type="hidden" name="agencyId" value={agency.id} />
                    <input type="hidden" name="redirectTo" value="/agency/pipeline" />
                    <button
                      type="submit"
                      className={buttonAccent}
                    >
                      Open agency portal (read-only)
                    </button>
                  </form>
                </div>
                ))}
              </div>
            )}
          </section>

          <section className="p-6 bg-[#111827] border border-white/5 rounded-2xl">
            <p className="text-xs text-zinc-500 mb-3">
              Users must complete the Supabase invite (or magic link) so <span className="font-mono text-zinc-400">authUserId</span>{' '}
              is set — required for row-level security when using the session Supabase client.
            </p>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">User Management</h2>
              <div className="flex items-center gap-2 text-xs">
                <a
                  href={`/admin?previewAgencyId=${previewAgencyId}&previewUserId=${previewUserId}&previewTalentId=${previewTalentId}&previewDays=${previewDays}`}
                  className={`rounded px-2 py-1 font-semibold ${selectedAgencyId ? 'bg-white/10 text-zinc-300' : 'bg-blue-600 text-white'}`}
                >
                  All Agencies
                </a>
                <form method="get" className="flex items-center gap-2">
                  <input type="hidden" name="previewAgencyId" value={previewAgencyId} />
                  <input type="hidden" name="previewUserId" value={previewUserId} />
                  <input type="hidden" name="previewTalentId" value={previewTalentId} />
                  <input type="hidden" name="previewDays" value={String(previewDays)} />
                  <select
                    name="agencyId"
                    defaultValue={selectedAgencyId}
                    className="rounded bg-white/10 border border-white/20 px-2 py-1 text-xs"
                  >
                    <option value="">Filter by agency…</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={buttonPrimary}>
                    Apply
                  </button>
                </form>
              </div>
            </div>
            {users.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#0D1526] p-5 text-sm text-zinc-400">
                No users in this view. Adjust filters or add a user from the panel above.
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {users.map((user: AdminDashboardUser) => (
                <div key={user.id} className="rounded-xl border border-white/10 p-4 bg-[#0D1526]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{user.email}</p>
                      <p className="text-xs text-zinc-400">{user.agency?.name ?? 'No Agency'}</p>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500 mt-1">
                        Auth:{' '}
                        <span className={user.authLinked ? 'text-emerald-400/90' : 'text-amber-400/90'}>
                          {user.authLinked ? 'Linked' : 'Not linked'}
                        </span>
                      </p>
                    </div>
                    <span className={`text-xs font-semibold ${user.active ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {user.active ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={updateUserRole} className="flex gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select name="role" defaultValue={user.role} className="rounded bg-white/10 border border-white/20 px-2 py-1 text-xs">
                        <option value="AGENCY_ADMIN">AGENCY_ADMIN</option>
                        <option value="AGENT">AGENT</option>
                        <option value="FINANCE">FINANCE</option>
                        <option value="TALENT">TALENT</option>
                      </select>
                      <button type="submit" className={buttonPrimary}>Update Role</button>
                    </form>
                    <form action={toggleUserActive}>
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="currentValue" value={String(user.active)} />
                      <button type="submit" className={user.active ? buttonWarning : buttonSecondary}>
                        {user.active ? 'Suspend' : 'Reactivate'}
                      </button>
                    </form>
                    <form action={resendInvite}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className={buttonInfo}>
                        Resend Invite
                      </button>
                    </form>
                    <form action={resetUserPassword}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button type="submit" className={buttonSecondary}>
                        Reset Password
                      </button>
                    </form>
                  </div>
                </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
