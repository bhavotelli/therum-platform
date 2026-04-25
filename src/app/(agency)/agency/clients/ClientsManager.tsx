'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ContactRole } from '@/types/database'
import { createClientWithContacts, updateClientWithContacts } from './actions'

type ContactDraft = {
  name: string
  email: string
  role: ContactRole
  phone: string
  notes: string
}

type ContactRequestView = {
  id: string
  requestedRole: ContactRole | null
  note: string | null
  createdAt: string
  requesterName: string
}

type ClientView = {
  id: string
  name: string
  paymentTermsDays: number
  vatNumber: string | null
  notes: string | null
  xeroContactId: string | null
  totalDeals: number
  activeDeals: number
  contacts: ContactDraft[]
  contactRequests: ContactRequestView[]
}

function formatRequestAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const emptyContact = (): ContactDraft => ({ name: '', email: '', role: 'PRIMARY', phone: '', notes: '' })

function ClientForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: {
    name: string
    paymentTermsDays: number
    vatNumber: string
    notes: string
    contacts: ContactDraft[]
  }
  onSubmit: (payload: {
    name: string
    paymentTermsDays: number
    vatNumber: string
    notes: string
    contacts: ContactDraft[]
  }) => Promise<void>
  submitLabel: string
}) {
  const [name, setName] = useState(initial.name)
  const [paymentTermsDays, setPaymentTermsDays] = useState(String(initial.paymentTermsDays))
  const [vatNumber, setVatNumber] = useState(initial.vatNumber)
  const [notes, setNotes] = useState(initial.notes)
  const [contacts, setContacts] = useState<ContactDraft[]>(initial.contacts.length ? initial.contacts : [emptyContact()])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const roleCounts = useMemo(() => {
    const primary = contacts.filter((c) => c.role === 'PRIMARY').length
    const finance = contacts.filter((c) => c.role === 'FINANCE').length
    return { primary, finance }
  }, [contacts])

  const canSubmit = roleCounts.primary >= 1 && roleCounts.finance <= 1 && contacts.length > 0

  const updateContact = (index: number, patch: Partial<ContactDraft>) => {
    setContacts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addContact = () => {
    if (contacts.length >= 5) return
    setContacts((prev) => [...prev, { ...emptyContact(), role: 'OTHER' }])
  }

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    setError(null)
    const parsedTerms = Number(paymentTermsDays)
    startTransition(async () => {
      try {
        await onSubmit({
          name,
          paymentTermsDays: parsedTerms,
          vatNumber,
          notes,
          contacts,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to save client')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client organisation name"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
        <input
          value={paymentTermsDays}
          onChange={(e) => setPaymentTermsDays(e.target.value)}
          placeholder="Payment terms days"
          type="number"
          min={1}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
        <input
          value={vatNumber}
          onChange={(e) => setVatNumber(e.target.value)}
          placeholder="VAT number (optional)"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Client notes (optional)"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Client Contacts</p>
          <button
            type="button"
            onClick={addContact}
            disabled={contacts.length >= 5}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 disabled:opacity-50"
          >
            Add contact
          </button>
        </div>
        {contacts.map((contact, idx) => (
          <div key={`${idx}-${contact.email}`} className="grid grid-cols-1 md:grid-cols-6 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <input
              value={contact.name}
              onChange={(e) => updateContact(idx, { name: e.target.value })}
              placeholder="Name"
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            />
            <input
              value={contact.email}
              onChange={(e) => updateContact(idx, { email: e.target.value })}
              placeholder="Email"
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            />
            <select
              value={contact.role}
              onChange={(e) => updateContact(idx, { role: e.target.value as ContactRole })}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="PRIMARY">PRIMARY</option>
              <option value="FINANCE">FINANCE</option>
              <option value="OTHER">OTHER</option>
            </select>
            <input
              value={contact.phone}
              onChange={(e) => updateContact(idx, { phone: e.target.value })}
              placeholder="Phone"
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            />
            <input
              value={contact.notes}
              onChange={(e) => updateContact(idx, { notes: e.target.value })}
              placeholder="Notes"
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            />
            <button
              type="button"
              onClick={() => removeContact(idx)}
              disabled={contacts.length === 1}
              className="rounded border border-rose-300 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <p className="text-[11px] text-zinc-500">
          Requires at least 1 PRIMARY contact. Only one FINANCE contact allowed. Max 5 contacts per client.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-rose-700">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !canSubmit}
        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? 'Saving...' : submitLabel}
      </button>
    </div>
  )
}

export default function ClientsManager({ clients }: { clients: ClientView[] }) {
  const [showCreate, setShowCreate] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)

  const create = async (payload: {
    name: string
    paymentTermsDays: number
    vatNumber: string
    notes: string
    contacts: ContactDraft[]
  }) => {
    const data = new FormData()
    data.set('name', payload.name)
    data.set('paymentTermsDays', String(payload.paymentTermsDays))
    data.set('vatNumber', payload.vatNumber)
    data.set('notes', payload.notes)
    data.set('contactsJson', JSON.stringify(payload.contacts))
    await createClientWithContacts(data)
    // The ClientForm catches thrown errors and surfaces them inline via
    // role="alert". We only reach here on success, so the toast is safe.
    toast.success(`${payload.name} added`)
    setShowCreate(false)
  }

  const update = async (
    clientId: string,
    payload: {
      name: string
      paymentTermsDays: number
      vatNumber: string
      notes: string
      contacts: ContactDraft[]
    },
  ) => {
    const data = new FormData()
    data.set('clientId', clientId)
    data.set('name', payload.name)
    data.set('paymentTermsDays', String(payload.paymentTermsDays))
    data.set('vatNumber', payload.vatNumber)
    data.set('notes', payload.notes)
    data.set('contactsJson', JSON.stringify(payload.contacts))
    await updateClientWithContacts(data)
    toast.success(`${payload.name} updated`)
    setEditingClientId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Client Records</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate((prev) => !prev); setEditingClientId(null) }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
        >
          {showCreate ? 'Cancel' : '+ Add Client'}
        </button>
      </div>

      {showCreate ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500 mb-4">New Client</h2>
          <ClientForm
            initial={{ name: '', paymentTermsDays: 30, vatNumber: '', notes: '', contacts: [emptyContact()] }}
            onSubmit={create}
            submitLabel="Create Client"
          />
        </div>
      ) : null}

      {clients.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-500 font-medium">No clients yet. Add your first client to start deal setup.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const isExpanded = editingClientId === client.id
            const primaryContact = client.contacts.find((c) => c.role === 'PRIMARY') ?? client.contacts[0]
            return (
              <div key={client.id} className={`rounded-2xl border bg-white shadow-sm transition-all duration-200 overflow-hidden ${isExpanded ? 'border-indigo-300 sm:col-span-2 xl:col-span-3' : 'border-zinc-200 hover:border-indigo-200 hover:shadow-md'}`}>
                {/* Card header — always visible */}
                <button
                  type="button"
                  onClick={() => setEditingClientId(isExpanded ? null : client.id)}
                  className="w-full text-left p-5 group relative"
                >
                  <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${isExpanded ? 'bg-indigo-500' : 'bg-zinc-300 group-hover:bg-indigo-400'}`} />
                  <div className="space-y-4">
                    <div>
                      <h2 className={`text-sm font-bold uppercase tracking-tight transition-colors ${isExpanded ? 'text-indigo-700' : 'text-zinc-900 group-hover:text-indigo-600'}`}>
                        {client.name}
                      </h2>
                      {primaryContact && (
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{primaryContact.email}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Deals</p>
                        <p className="text-lg font-bold text-zinc-900 tabular-nums">{client.totalDeals}</p>
                      </div>
                      <div className={`rounded-lg border px-3 py-2 ${client.activeDeals > 0 ? 'border-blue-100 bg-blue-50' : 'border-zinc-100 bg-zinc-50'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${client.activeDeals > 0 ? 'text-blue-500' : 'text-zinc-400'}`}>Active</p>
                        <p className={`text-lg font-bold tabular-nums ${client.activeDeals > 0 ? 'text-blue-700' : 'text-zinc-900'}`}>{client.activeDeals}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded border border-zinc-200 bg-zinc-50 text-zinc-500 uppercase tracking-wider">
                        {client.paymentTermsDays}d terms
                      </span>
                      {client.vatNumber && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-wider">
                          VAT {client.vatNumber}
                        </span>
                      )}
                      {client.xeroContactId && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded border border-teal-200 bg-teal-50 text-teal-700 uppercase tracking-wider">
                          Xero Linked
                        </span>
                      )}
                      {client.contactRequests.length > 0 && (
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded border border-amber-300 bg-amber-100 text-amber-800 uppercase tracking-wider"
                          title={`Finance asked for a contact${client.contactRequests.length > 1 ? `s (${client.contactRequests.length})` : ''}`}
                        >
                          Finance request
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {isExpanded ? 'Close' : 'View & Edit'}
                      </span>
                      <svg className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded detail + edit */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 p-5 space-y-4 bg-zinc-50/50">
                    {client.contactRequests.length > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.73 4a2 2 0 00-3.46 0L3.19 16a2 2 0 001.74 3z" />
                          </svg>
                          <p className="text-xs font-black uppercase tracking-widest text-amber-800">
                            Finance is waiting on a contact for this client
                          </p>
                        </div>
                        <ul className="space-y-1.5">
                          {client.contactRequests.map((req) => (
                            <li key={req.id} className="text-xs text-amber-900">
                              <span className="font-semibold">{req.requesterName}</span>
                              <span className="text-amber-700"> · {formatRequestAge(req.createdAt)}</span>
                              {req.requestedRole && (
                                <span className="ml-1.5 inline-flex items-center rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                  {req.requestedRole}
                                </span>
                              )}
                              {req.note && (
                                <p className="text-[11px] text-amber-800/80 mt-0.5 italic">&ldquo;{req.note}&rdquo;</p>
                              )}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-amber-700">
                          Adding any contact below will close all open requests for this client.
                        </p>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">All Contacts</h3>
                      <div className="space-y-1.5">
                        {client.contacts.map((c, idx) => (
                          <div key={`${c.email}-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-700 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-zinc-400">·</span>
                            <span>{c.email}</span>
                            {c.phone && <><span className="text-zinc-400">·</span><span>{c.phone}</span></>}
                            <span className={`ml-auto text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${c.role === 'FINANCE' ? 'bg-teal-50 text-teal-700 border border-teal-200' : c.role === 'PRIMARY' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                              {c.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Edit Client</h3>
                      <ClientForm
                        initial={{
                          name: client.name,
                          paymentTermsDays: client.paymentTermsDays,
                          vatNumber: client.vatNumber ?? '',
                          notes: client.notes ?? '',
                          contacts: client.contacts.length ? client.contacts : [emptyContact()],
                        }}
                        onSubmit={(payload) => update(client.id, payload)}
                        submitLabel="Save Changes"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
