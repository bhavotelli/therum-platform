'use client'

type Props = {
  invoiceRef: string | null
  clientName: string
}

function buildFilename(invoiceRef: string | null, clientName: string) {
  const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  return `${sanitize(invoiceRef ?? 'invoice')}_${sanitize(clientName)}_${date}`
}

export default function InvoicePrintButton({ invoiceRef, clientName }: Props) {
  const handleSaveAsPdf = () => {
    const original = document.title
    document.title = buildFilename(invoiceRef, clientName)
    window.print()
    document.title = original
  }

  return (
    <div className="export-toolbar flex items-center gap-2">
      <button
        type="button"
        onClick={handleSaveAsPdf}
        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Save as PDF
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print
      </button>
    </div>
  )
}
