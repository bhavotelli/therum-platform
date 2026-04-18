'use client'

import { useMemo, useState, useTransition } from 'react'
import type { ContactRole } from '@/types/database'
import { createClientWithContacts, updateClientWithContacts } from './actions'

type ContactDraft = {
  name: string
  email: string
  role: ContactRole
  phone: string
  notes: string
}

type ClientView = {
  id: string
  name: string
  paymentTermsDays: number
  vatNumber: string | null
  notes: string | null
  xeroContactId: string | null
  contacts: ContactDraft[]
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

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
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
    setEditingClientId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900">Client Records</h1>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
        >
          {showCreate ? 'Close' : 'Add Client'}
        </button>
      </div>

      {showCreate ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <ClientForm
            initial={{ name: '', paymentTermsDays: 30, vatNumber: '', notes: '', contacts: [emptyContact()] }}
            onSubmit={create}
            submitLabel="Create client"
          />
        </div>
      ) : null}

      {clients.length === 0 ? (
        <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
          <p className="text-zinc-500 font-medium">No clients yet. Add your first client to start deal setup.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => {
            const isEditing = editingClientId === client.id
            return (
              <div key={client.id} className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{client.name}</p>
                    <p className="text-xs text-zinc-500">
                      Terms: {client.paymentTermsDays} days · {client.xeroContactId ? 'Linked to Xero' : 'Not linked to Xero'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingClientId(isEditing ? null : client.id)}
                    className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700"
                  >
                    {isEditing ? 'Close' : 'Edit'}
                  </button>
                </div>

                {!isEditing ? (
                  <div className="space-y-1">
                    {client.contacts.map((c, idx) => (
                      <p key={`${c.email}-${idx}`} className="text-xs text-zinc-600">
                        {c.name} · {c.email} · {c.role}
                      </p>
                    ))}
                  </div>
                ) : (
                  <ClientForm
                    initial={{
                      name: client.name,
                      paymentTermsDays: client.paymentTermsDays,
                      vatNumber: client.vatNumber ?? '',
                      notes: client.notes ?? '',
                      contacts: client.contacts.length ? client.contacts : [emptyContact()],
                    }}
                    onSubmit={(payload) => update(client.id, payload)}
                    submitLabel="Save client"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
