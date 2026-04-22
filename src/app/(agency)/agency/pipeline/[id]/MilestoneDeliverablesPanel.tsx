'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createDeliverable, updateDeliverableStatus } from './actions'

type DeliverableItem = {
  id: string
  title: string
  dueDate: string | null
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED'
}

type MilestoneDeliverablesPanelProps = {
  milestoneId: string
  deliverables: DeliverableItem[]
}

export default function MilestoneDeliverablesPanel({
  milestoneId,
  deliverables,
}: MilestoneDeliverablesPanelProps) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isPending, startTransition] = useTransition()

  const addDeliverable = () => {
    startTransition(async () => {
      try {
        await createDeliverable({
          milestoneId,
          title,
          dueDate: dueDate || undefined,
        })
        setTitle('')
        setDueDate('')
        toast.success('Deliverable added')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add deliverable.')
      }
    })
  }

  const setStatus = (deliverableId: string, status: DeliverableItem['status']) => {
    startTransition(async () => {
      try {
        await updateDeliverableStatus({ deliverableId, status })
        toast.success(`Deliverable marked ${status.toLowerCase()}`)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update deliverable status.')
      }
    })
  }

  return (
    <div className="space-y-3">
      {deliverables.length === 0 ? (
        <p className="text-sm text-gray-500">No deliverables yet.</p>
      ) : (
        <div className="space-y-2">
          {deliverables.map((deliverable) => (
            <div key={deliverable.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{deliverable.title}</p>
                  <p className="text-xs text-gray-500">
                    {deliverable.dueDate
                      ? `Due ${new Date(deliverable.dueDate).toLocaleDateString('en-GB')}`
                      : 'No due date'}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {deliverable.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isPending || deliverable.status === 'PENDING'}
                  onClick={() => setStatus(deliverable.id, 'PENDING')}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  PENDING
                </button>
                <button
                  type="button"
                  disabled={isPending || deliverable.status === 'SUBMITTED'}
                  onClick={() => setStatus(deliverable.id, 'SUBMITTED')}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 disabled:opacity-50"
                >
                  SUBMITTED
                </button>
                <button
                  type="button"
                  disabled={isPending || deliverable.status === 'APPROVED'}
                  onClick={() => setStatus(deliverable.id, 'APPROVED')}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                >
                  APPROVED
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-100 bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Add Deliverable</p>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 md:col-span-2"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={isPending || !title.trim()}
            onClick={addDeliverable}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Add Deliverable'}
          </button>
        </div>
      </div>
    </div>
  )
}
