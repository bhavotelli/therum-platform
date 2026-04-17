'use client'

import { useState, useTransition } from 'react'
import { updateDealWorkspace } from './actions'

type DealWorkspacePanelProps = {
  dealId: string
  initialNotes: string
  initialContractRef: string
}

export default function DealWorkspacePanel({
  dealId,
  initialNotes,
  initialContractRef,
}: DealWorkspacePanelProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [contractRef, setContractRef] = useState(initialContractRef)
  const [status, setStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isDragOver, setIsDragOver] = useState(false)

  const handleSave = () => {
    setStatus(null)
    startTransition(async () => {
      try {
        await updateDealWorkspace({
          dealId,
          notes,
          contractRef,
        })
        setStatus('Saved')
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to save.')
      }
    })
  }

  const handleFileSelection = (file: File | null) => {
    if (!file) return
    // MVP storage: capture selected filename/reference against deal.contractRef.
    setContractRef(file.name)
    setStatus(`Selected file: ${file.name}. Click "Save Notes & File Ref".`)
  }

  return (
    <section className="space-y-4 pt-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Agency Notes</h2>
        <p className="text-sm text-gray-500 mt-1">
          Internal notes for this deal. Visible to agency team only.
        </p>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={8}
          placeholder="Add deal context, client updates, risks, and next actions..."
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Files & Contract</h2>
        <p className="text-sm text-gray-500 mt-1">
          Drag and drop a contract file to attach a reference on this deal.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragOver(false)
            const file = event.dataTransfer.files?.[0] ?? null
            handleFileSelection(file)
          }}
          className={`mt-4 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            isDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <p className="text-sm font-medium text-gray-700">Drop contract file here</p>
          <p className="text-xs text-gray-500 mt-1">or choose from your computer</p>
          <label className="inline-flex mt-3 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100">
            Select file
            <input
              type="file"
              className="hidden"
              onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-gray-500">
          Contract/File Reference
        </label>
        <input
          value={contractRef}
          onChange={(event) => setContractRef(event.target.value)}
          placeholder="No file attached yet"
          className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{status ? status : 'Unsaved changes'}</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save Notes & File Ref'}
        </button>
      </div>
    </section>
  )
}
