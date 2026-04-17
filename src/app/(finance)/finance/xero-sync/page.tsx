import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  pullLatestXeroContactAndTalentSync,
  pullLatestXeroPaidStatuses,
  pushMissingXeroContactsAndTalentLinks,
  refreshXeroOrganisationProfile,
  resolveXeroContactConflict,
  saveXeroAccountCodeMappings,
} from './actions'
import { buildXeroContactSyncPreview, getAgencyXeroContextForUser } from '@/lib/xero-contact-sync'

export const dynamic = 'force-dynamic'

function formatDateTime(value: Date | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default async function XeroSyncPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }

  const userId = (session.user as { id?: string }).id
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { agencyId: true },
      })
    : null

  const agency = user?.agencyId
    ? await prisma.agency.findUnique({
        where: { id: user.agencyId },
        select: {
          id: true,
          name: true,
          xeroTenantId: true,
          xeroTokens: true,
          xeroAccountCodes: true,
          invoicingModel: true,
        },
      })
    : await prisma.agency.findFirst({
        select: {
          id: true,
          name: true,
          xeroTenantId: true,
          xeroTokens: true,
          xeroAccountCodes: true,
          invoicingModel: true,
        },
      })

  if (!agency) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900">Xero Sync Status</h1>
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-400 mb-2">No agency found.</p>
          <p className="text-zinc-500 text-sm max-w-sm">Create or seed an agency to view sync diagnostics.</p>
        </div>
      </div>
    )
  }

  let contactSyncPreview: Awaited<ReturnType<typeof buildXeroContactSyncPreview>> | null = null
  try {
    const context = await getAgencyXeroContextForUser(userId)
    contactSyncPreview = await buildXeroContactSyncPreview(context)
  } catch {
    contactSyncPreview = null
  }

  const [pushedTripletsCount, paidTripletsCount, lastPushedTriplet, lastPaidTriplet, linkedTalentCount, linkedClientCount, webhookAudit] = await Promise.all([
    prisma.invoiceTriplet.count({
      where: {
        milestone: { deal: { agencyId: agency.id } },
        OR: [
          { xeroInvId: { not: null } },
          { xeroObiId: { not: null } },
        ],
      },
    }),
    prisma.invoiceTriplet.count({
      where: {
        milestone: { deal: { agencyId: agency.id } },
        invPaidAt: { not: null },
      },
    }),
    prisma.invoiceTriplet.findFirst({
      where: {
        milestone: { deal: { agencyId: agency.id } },
        OR: [
          { xeroInvId: { not: null } },
          { xeroObiId: { not: null } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        invNumber: true,
        obiNumber: true,
        updatedAt: true,
      },
    }),
    prisma.invoiceTriplet.findFirst({
      where: {
        milestone: { deal: { agencyId: agency.id } },
        invPaidAt: { not: null },
      },
      orderBy: { invPaidAt: 'desc' },
      select: {
        invNumber: true,
        obiNumber: true,
        invPaidAt: true,
      },
    }),
    prisma.talent.count({
      where: {
        agencyId: agency.id,
        xeroContactId: { not: null },
      },
    }),
    prisma.client.count({
      where: {
        agencyId: agency.id,
        xeroContactId: { not: null },
      },
    }),
    prisma.adminAuditLog.findMany({
      where: {
        action: {
          in: ['XERO_WEBHOOK_RECEIVED', 'XERO_WEBHOOK_PROCESSED', 'XERO_WEBHOOK_FAILED', 'XERO_WEBHOOK_DIAGNOSTIC'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 12,
    }),
  ])

  const webhookConfigured = Boolean(process.env.XERO_WEBHOOK_KEY)
  const xeroConnected = Boolean(agency.xeroTenantId && agency.xeroTokens)
  const codes = (agency.xeroAccountCodes && typeof agency.xeroAccountCodes === 'object'
    ? (agency.xeroAccountCodes as Record<string, unknown>)
    : {}) as {
    mappings?: {
      inv?: string | null
      sbi?: string | null
      obi?: string | null
      cn?: string | null
      com?: string | null
      expenses?: string | null
    }
    xeroOrgProfile?: {
      registeredName?: string | null
      registeredAddress?: string | null
    }
  }
  const mappings = codes.mappings ?? {}
  const mappingReady =
    agency.invoicingModel === 'SELF_BILLING'
      ? Boolean(mappings.inv && mappings.sbi && mappings.com)
      : Boolean(mappings.obi && mappings.cn && mappings.com)
  const orgProfileReady = Boolean(codes.xeroOrgProfile?.registeredName || codes.xeroOrgProfile?.registeredAddress)
  const conflictsCount =
    (contactSyncPreview?.talent.filter((r) => r.action === 'CONFLICT').length ?? 0) +
    (contactSyncPreview?.clients.filter((r) => r.action === 'CONFLICT').length ?? 0)
  const syncStepReady = Boolean(contactSyncPreview) && conflictsCount === 0
  const wizardCompleted = xeroConnected && orgProfileReady && mappingReady && syncStepReady && webhookConfigured
  const setupSteps = [
    {
      title: 'Connect Xero tenant',
      done: xeroConnected,
      hint: xeroConnected ? 'Tenant is connected.' : 'Connect Xero first from Finance Settings.',
    },
    {
      title: 'Pull organisation profile',
      done: orgProfileReady,
      hint: orgProfileReady ? 'Registered name/address cached from Xero.' : 'Refresh and confirm legal organisation details.',
    },
    {
      title: 'Configure account code mappings',
      done: mappingReady,
      hint: mappingReady
        ? 'Required account codes are set.'
        : `Set required ${agency.invoicingModel === 'SELF_BILLING' ? 'INV/SBI/COM' : 'OBI/CN/COM'} codes.`,
    },
    {
      title: 'Resolve contact sync conflicts',
      done: syncStepReady,
      hint: syncStepReady ? 'No unresolved conflicts remain.' : `${conflictsCount} conflict(s) need linking.`,
    },
    {
      title: 'Confirm webhook signature',
      done: webhookConfigured,
      hint: webhookConfigured ? 'Webhook signature key is present.' : 'Missing XERO_WEBHOOK_KEY in environment.',
    },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Xero Sync Status</h1>
        <p className="text-sm text-zinc-500 mt-1">Webhook and sync diagnostics for {agency.name}.</p>
      </header>

      <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-900">Setup Wizard</h2>
            <p className="text-sm text-indigo-800 mt-1">
              Guided launch checks before go-live. Complete each step in order to keep Xero mappings and sync behavior safe.
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${wizardCompleted ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
            {wizardCompleted ? 'Ready for UAT go-live' : 'Setup in progress'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {setupSteps.map((step) => (
            <div key={step.title} className="rounded-xl border border-indigo-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">{step.title}</p>
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {step.done ? 'OK' : '—'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">{step.hint}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={refreshXeroOrganisationProfile}>
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
              disabled={!xeroConnected}
            >
              Refresh Xero organisation profile
            </button>
          </form>
          <a
            href="/finance/settings"
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Open Finance Settings
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Account Code Mapping</h2>
        <p className="text-sm text-zinc-500">
          Set model-specific Xero account codes. These mappings are validated before go-live and used for invoice/CN generation.
        </p>
        <form action={saveXeroAccountCodeMappings} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-zinc-600">
            INV account code
            <input name="inv" defaultValue={mappings.inv ?? ''} placeholder="e.g. 200" className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700" />
          </label>
          <label className="text-xs font-semibold text-zinc-600">
            SBI account code
            <input name="sbi" defaultValue={mappings.sbi ?? ''} placeholder="e.g. 400" className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700" />
          </label>
          {agency.invoicingModel === 'ON_BEHALF' ? (
            <label className="text-xs font-semibold text-zinc-600">
              OBI account code
              <input name="obi" defaultValue={mappings.obi ?? ''} placeholder="e.g. 200" className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700" />
            </label>
          ) : null}
          <label className="text-xs font-semibold text-zinc-600">
            CN account code
            <input name="cn" defaultValue={mappings.cn ?? ''} placeholder="e.g. 200" className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700" />
          </label>
          <label className="text-xs font-semibold text-zinc-600">
            COM account code
            <input name="com" defaultValue={mappings.com ?? ''} placeholder="e.g. 200" className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700" />
          </label>
          <label className="text-xs font-semibold text-zinc-600">
            Expenses account code
            <input name="expenses" defaultValue={mappings.expenses ?? ''} placeholder="e.g. 300" className="mt-1 block w-full rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700" />
          </label>
          <div className="md:col-span-2 xl:col-span-3 pt-1">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Save mapping
            </button>
            <p className="text-xs text-zinc-500 mt-2">
              Required now for {agency.invoicingModel === 'SELF_BILLING' ? 'SELF_BILLING: INV + SBI + COM' : 'ON_BEHALF: OBI + CN + COM'}.
            </p>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Xero Connection</p>
          <p className={`text-xl font-black mt-2 ${xeroConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
            {xeroConnected ? 'Connected' : 'Not connected'}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Webhook Signature</p>
          <p className={`text-xl font-black mt-2 ${webhookConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {webhookConfigured ? 'Configured' : 'Missing key'}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Triplets pushed</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{pushedTripletsCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Paid webhooks applied</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{paidTripletsCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Talent linked to Xero</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{linkedTalentCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500">Clients linked to Xero</p>
          <p className="text-3xl font-black text-zinc-900 mt-2">{linkedClientCount}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Webhook Test Checklist</h2>
        <div className="text-sm text-zinc-700 space-y-1.5">
          <p>Endpoint: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">/api/webhooks/xero</code></p>
          <p>Last pushed invoice: <span className="font-semibold">{lastPushedTriplet?.invNumber ?? lastPushedTriplet?.obiNumber ?? '—'}</span> at {formatDateTime(lastPushedTriplet?.updatedAt ?? null)}</p>
          <p>Last paid sync: <span className="font-semibold">{lastPaidTriplet?.invNumber ?? lastPaidTriplet?.obiNumber ?? '—'}</span> at {formatDateTime(lastPaidTriplet?.invPaidAt ?? null)}</p>
          <p className="text-xs text-zinc-500 pt-1">
            Intent-to-receive should return HTTP 200. After marking a pushed invoice as paid in Xero, this page and Finance Dashboard should reflect the sync.
          </p>
        </div>
        <form action={pullLatestXeroPaidStatuses} className="pt-1">
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            Pull latest paid statuses now
          </button>
        </form>
        <form action={pullLatestXeroContactAndTalentSync} className="pt-1">
          <button
            type="submit"
            className="inline-flex items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Sync contacts and talent links
          </button>
        </form>
        <form action={pushMissingXeroContactsAndTalentLinks} className="pt-1">
          <button
            type="submit"
            className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            Push missing contacts to Xero
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Setup Ownership</p>
        <p className="mt-1 text-sm text-amber-800">
          Source of truth should be the Agency portal for creating and editing Talent/Clients. Finance portal should handle sync review,
          conflict resolution, and push controls to avoid duplicate record creation.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700">Contact Sync Preview</h2>
        {!contactSyncPreview ? (
          <p className="text-sm text-zinc-500">Preview unavailable until Xero is connected.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Xero contacts fetched</p>
                <p className="text-xl font-black text-zinc-900 mt-1">{contactSyncPreview.xeroContactsFetched}</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Will link existing</p>
                <p className="text-xl font-black text-indigo-700 mt-1">
                  {contactSyncPreview.talent.filter((r) => r.action === 'LINK_EXISTING').length +
                    contactSyncPreview.clients.filter((r) => r.action === 'LINK_EXISTING').length}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Will create in Xero</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  {contactSyncPreview.talent.filter((r) => r.action === 'CREATE_IN_XERO').length +
                    contactSyncPreview.clients.filter((r) => r.action === 'CREATE_IN_XERO').length}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Conflicts to review</p>
                <p className="text-xl font-black text-amber-700 mt-1">
                  {contactSyncPreview.talent.filter((r) => r.action === 'CONFLICT').length +
                    contactSyncPreview.clients.filter((r) => r.action === 'CONFLICT').length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">Talent Sync Plan</h3>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Talent</th>
                        <th className="px-3 py-2 text-left font-semibold">Action</th>
                        <th className="px-3 py-2 text-left font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {contactSyncPreview.talent.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-zinc-800">{row.name}</p>
                            <p className="text-zinc-500">{row.email}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded border px-2 py-0.5 font-semibold bg-zinc-50 text-zinc-700 border-zinc-200">
                              {row.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600">Client Sync Plan</h3>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Client</th>
                        <th className="px-3 py-2 text-left font-semibold">Action</th>
                        <th className="px-3 py-2 text-left font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {contactSyncPreview.clients.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-zinc-800">{row.name}</p>
                            <p className="text-zinc-500">{row.preferredEmail ?? 'No contact email'}</p>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded border px-2 py-0.5 font-semibold bg-zinc-50 text-zinc-700 border-zinc-200">
                              {row.action}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-zinc-600">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {(contactSyncPreview.talent.some((r) => r.action === 'CONFLICT') ||
              contactSyncPreview.clients.some((r) => r.action === 'CONFLICT')) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">Resolve Sync Conflicts</h3>
                <div className="space-y-2">
                  {contactSyncPreview.talent
                    .filter((row) => row.action === 'CONFLICT')
                    .map((row) => (
                      <form key={`talent-${row.id}`} action={resolveXeroContactConflict} className="rounded-lg border border-amber-200 bg-white px-3 py-2 flex flex-col md:flex-row md:items-center gap-2">
                        <input type="hidden" name="recordType" value="TALENT" />
                        <input type="hidden" name="recordId" value={row.id} />
                        <div className="md:w-64">
                          <p className="text-xs font-semibold text-zinc-800">{row.name}</p>
                          <p className="text-[11px] text-zinc-500">{row.email}</p>
                        </div>
                        <select
                          name="xeroContactId"
                          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>Select matching Xero contact</option>
                          {row.candidateMatches.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                          ))}
                        </select>
                        <button type="submit" className="inline-flex items-center rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200">
                          Link
                        </button>
                      </form>
                    ))}

                  {contactSyncPreview.clients
                    .filter((row) => row.action === 'CONFLICT')
                    .map((row) => (
                      <form key={`client-${row.id}`} action={resolveXeroContactConflict} className="rounded-lg border border-amber-200 bg-white px-3 py-2 flex flex-col md:flex-row md:items-center gap-2">
                        <input type="hidden" name="recordType" value="CLIENT" />
                        <input type="hidden" name="recordId" value={row.id} />
                        <div className="md:w-64">
                          <p className="text-xs font-semibold text-zinc-800">{row.name}</p>
                          <p className="text-[11px] text-zinc-500">{row.preferredEmail ?? 'No preferred email'}</p>
                        </div>
                        <select
                          name="xeroContactId"
                          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700"
                          required
                          defaultValue=""
                        >
                          <option value="" disabled>Select matching Xero contact</option>
                          {row.candidateMatches.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
                          ))}
                        </select>
                        <button type="submit" className="inline-flex items-center rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200">
                          Link
                        </button>
                      </form>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700 mb-3">Webhook Receipt Log</h2>
        {webhookAudit.length === 0 ? (
          <p className="text-sm text-zinc-500">No webhook events logged yet.</p>
        ) : (
          <div className="space-y-2">
            {webhookAudit.map((log) => (
              <div key={log.id} className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-zinc-700">{log.action}</p>
                  <p className="text-[11px] text-zinc-500">{formatDateTime(log.createdAt)}</p>
                </div>
                <p className="text-xs text-zinc-600">
                  {log.targetType}{log.targetId ? ` · ${log.targetId}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
