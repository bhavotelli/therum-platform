'use client'

import { useState, useRef } from 'react'
import { createTalent } from '../actions'

export default function NewTalentForm() {
  const [businessType, setBusinessType] = useState<'SELF_EMPLOYED' | 'LTD_COMPANY'>('SELF_EMPLOYED')
  const [vatRegistered, setVatRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const form = formRef.current!
    const fd = new FormData(form)

    if (vatRegistered && !String(fd.get('vatNumber') ?? '').trim()) {
      setError('VAT number is required when VAT registered is ticked.')
      return
    }
    if (businessType === 'LTD_COMPANY') {
      if (!String(fd.get('companyName') ?? '').trim()) {
        setError('Company name is required for Limited Companies.')
        return
      }
      if (!String(fd.get('companyRegNumber') ?? '').trim()) {
        setError('Company registration number is required for Limited Companies.')
        return
      }
    }

    setSubmitting(true)
    try {
      await createTalent(fd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
      setSubmitting(false)
    }
  }

  const inputCls = 'mt-1 block w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'text-sm font-semibold text-zinc-700'

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {error && (
        <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Core identity */}
      <label className={labelCls}>
        Talent Name
        <input name="name" required className={inputCls} placeholder="e.g. Zara Mitchell" />
      </label>
      <label className={labelCls}>
        Email Address
        <input name="email" type="email" required className={inputCls} placeholder="zara@talentstudio.com" />
      </label>
      <label className={labelCls}>
        Default Commission Rate (%)
        <input name="commissionRate" type="number" min="0" max="100" step="0.01" required defaultValue="20" className={inputCls} />
      </label>

      {/* Business type */}
      <label className={labelCls}>
        Business Type
        <select
          name="businessType"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value as 'SELF_EMPLOYED' | 'LTD_COMPANY')}
          className={inputCls}
        >
          <option value="SELF_EMPLOYED">Self-Employed / Sole Trader</option>
          <option value="LTD_COMPANY">Limited Company</option>
        </select>
      </label>

      {/* LTD-only fields */}
      {businessType === 'LTD_COMPANY' && (
        <>
          <label className={labelCls}>
            Company Name
            <input name="companyName" required className={inputCls} placeholder="e.g. Zara Mitchell Ltd" />
          </label>
          <label className={labelCls}>
            Company Registration Number
            <input name="companyRegNumber" required className={inputCls} placeholder="e.g. 12345678" />
          </label>
        </>
      )}

      {/* Registered address — always shown */}
      <div className="md:col-span-2">
        <label className={labelCls}>
          Registered Address
          <textarea
            name="registeredAddress"
            rows={3}
            className={inputCls}
            placeholder="Street, City, Postcode"
          />
        </label>
      </div>

      {/* VAT */}
      <div className="flex flex-col gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer">
          <input
            name="vatRegistered"
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300"
            checked={vatRegistered}
            onChange={(e) => setVatRegistered(e.target.checked)}
          />
          VAT Registered
        </label>
        {vatRegistered && (
          <label className={labelCls}>
            VAT Number
            <input name="vatNumber" required className={inputCls} placeholder="GB123456789" />
          </label>
        )}
      </div>

      {/* Portal access */}
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 cursor-pointer self-start mt-1">
        <input name="portalEnabled" type="checkbox" className="h-4 w-4 rounded border-zinc-300" />
        Enable talent portal access
      </label>

      <div className="md:col-span-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Talent'}
        </button>
      </div>
    </form>
  )
}
