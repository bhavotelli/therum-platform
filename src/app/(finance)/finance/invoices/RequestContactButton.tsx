'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createContactRequest } from './actions'

type Variant = 'compact' | 'detail'

export default function RequestContactButton({
  clientId,
  clientName,
  alreadyRequested,
  variant,
}: {
  clientId: string
  clientName: string
  alreadyRequested: boolean
  variant: Variant
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const roleRef = useRef<HTMLSelectElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  // The pill on the invoice queue lives inside the parent <form action=
  // {approveInvoiceTriplet}> row. HTML forbids nested forms (the inner
  // submit gets neutered), so we build FormData by hand on click instead
  // of using a real <form>.
  const submit = () => {
    const fd = new FormData()
    fd.set('clientId', clientId)
    fd.set('requestedRole', roleRef.current?.value ?? '')
    fd.set('note', noteRef.current?.value ?? '')
    startTransition(async () => {
      try {
        await createContactRequest(fd)
        toast.success(`Asked the agency team to add a contact for ${clientName}.`)
        setOpen(false)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not send request')
      }
    })
  }

  const isCompact = variant === 'compact'
  const pillClass = isCompact
    ? 'inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-colors'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-colors'

  if (alreadyRequested) {
    return (
      <span
        className={
          isCompact
            ? 'inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700'
        }
        title={`Contact request sent to the agency team for ${clientName}`}
      >
        <svg className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Request sent
      </span>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={pillClass}
        title={`No contact on file for ${clientName} — click to ask the agency team to add one`}
      >
        <svg className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.73 4a2 2 0 00-3.46 0L3.19 16a2 2 0 001.74 3z" />
        </svg>
        Request contact
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs w-[280px]">
      <p className="text-amber-900 font-semibold">
        Ask agency to add a contact for {clientName}
      </p>
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
        Role hint (optional)
        <select
          ref={roleRef}
          defaultValue=""
          className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-zinc-700 font-normal normal-case tracking-normal"
        >
          <option value="">No preference</option>
          <option value="FINANCE">Finance / AP</option>
          <option value="PRIMARY">Primary contact</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
        Note (optional)
        <textarea
          ref={noteRef}
          maxLength={500}
          rows={2}
          placeholder="e.g. their AP team's invoice email"
          className="rounded border border-amber-300 bg-white px-2 py-1 text-xs text-zinc-700 font-normal normal-case tracking-normal"
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md border border-amber-400 bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
        >
          {pending ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  )
}
