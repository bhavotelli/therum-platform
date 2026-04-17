'use client'

import { useState } from 'react'

type Props = {
  invoiceRef: string
  clientName: string
}

function buildPdfTitle(invoiceRef: string, clientName: string) {
  const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  const ref = sanitize(invoiceRef || 'invoice')
  const client = sanitize(clientName || 'client')
  return `${ref}_${client}_${date}`
}

export default function InvoicePrintButton({ invoiceRef, clientName }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const [minimalPdfMode, setMinimalPdfMode] = useState(false)

  const setPdfMode = (mode: 'standard' | 'minimal') => {
    document.documentElement.setAttribute('data-pdf-mode', mode)
  }

  const exportPdf = async () => {
    const previousMode = document.documentElement.getAttribute('data-pdf-mode') ?? 'standard'
    setPdfMode(minimalPdfMode ? 'minimal' : 'standard')
    setIsExporting(true)
    try {
      const [htmlToImageModule, jsPdfModule] = await Promise.all([import('html-to-image'), import('jspdf')])
      const JsPdf = jsPdfModule.default
      const sourceEl = document.querySelector('.invoice-print-root') as HTMLElement | null
      if (!sourceEl) {
        throw new Error('Invoice print root not found')
      }

      const imageData = await htmlToImageModule.toPng(sourceEl, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      })
      const image = new Image()
      image.src = imageData
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Failed to load rendered invoice image'))
      })
      const pdf = new JsPdf({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imageHeight = (image.height * pdfWidth) / image.width
      let renderedHeight = imageHeight
      let position = 0

      pdf.addImage(imageData, 'PNG', 0, position, pdfWidth, imageHeight)
      renderedHeight -= pdfHeight
      while (renderedHeight > 0) {
        position = renderedHeight - imageHeight
        pdf.addPage()
        pdf.addImage(imageData, 'PNG', 0, position, pdfWidth, imageHeight)
        renderedHeight -= pdfHeight
      }

      pdf.save(`${buildPdfTitle(invoiceRef, clientName)}.pdf`)
    } finally {
      document.documentElement.setAttribute('data-pdf-mode', previousMode)
      setIsExporting(false)
    }
  }

  return (
    <div className="export-toolbar flex items-center gap-2">
      <button
        type="button"
        onClick={() => setMinimalPdfMode((value) => !value)}
        className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold ${
          minimalPdfMode
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50'
        }`}
      >
        Minimal PDF: {minimalPdfMode ? 'On' : 'Off'}
      </button>
      <button
        type="button"
        onClick={exportPdf}
        disabled={isExporting}
        className="inline-flex items-center rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
      >
        {isExporting ? 'Generating PDF...' : 'Export PDF'}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
      >
        Print
      </button>
      <span className="text-[11px] text-zinc-500">PDF exports include invoice body only</span>
    </div>
  )
}
