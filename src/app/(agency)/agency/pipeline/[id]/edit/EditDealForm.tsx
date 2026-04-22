'use client'

import { useState } from 'react'
import { getDealActivationReadiness, updateDeal } from '../../actions'
import { useRouter } from 'next/navigation'
import type { DealStage } from '@/types/database'

// Mirror of STAGE_ORDER in pipeline/actions.ts. Kept in sync so the edit
// form's stage dropdown offers only transitions the server will accept.
const STAGE_ORDER: DealStage[] = ['PIPELINE', 'NEGOTIATING', 'CONTRACTED', 'ACTIVE', 'IN_BILLING', 'COMPLETED']
const STAGE_OPTIONS: Array<{ value: DealStage; label: string }> = [
  { value: 'PIPELINE', label: 'Prospect' },
  { value: 'NEGOTIATING', label: 'Negotiating' },
  { value: 'CONTRACTED', label: 'Contracting' },
  { value: 'ACTIVE', label: 'Active' },
]

// Given the deal's current stage, return the set of stage values the user
// can pick in the edit form:
//   - The current stage itself (always — "no change" is valid)
//   - Its immediate neighbours (matches server's assertValidStageTransition)
//   - IN_BILLING and COMPLETED are system-controlled; never offered
//   - If current stage is IN_BILLING or COMPLETED, only that stage is
//     shown (disabled-like) so the form doesn't pretend it's editable
function stageOptionsFor(current: DealStage): Array<{ value: DealStage; label: string }> {
  const currentIdx = STAGE_ORDER.indexOf(current)
  if (current === 'IN_BILLING' || current === 'COMPLETED') {
    return [
      { value: current, label: current === 'IN_BILLING' ? 'In Billing' : 'Completed' },
    ]
  }
  return STAGE_OPTIONS.filter((o) => {
    const idx = STAGE_ORDER.indexOf(o.value)
    return Math.abs(idx - currentIdx) <= 1
  })
}

interface EditDealFormProps {
  deal: {
    id: string
    title: string
    clientId: string
    talentId: string
    commissionRate: string
    currency: string
    stage: string
    milestones: {
      id: string
      description: string
      grossAmount: string
      invoiceDate: string
      status: string
    }[]
  }
  clients: { id: string; name: string }[]
  talents: { id: string; name: string }[]
}

type ReadinessItem = {
  id: string
  status: 'pass' | 'warn' | 'block'
  message: string
}

type MilestoneDraft = {
  id: string
  description: string
  grossAmount: string
  percentage: string
  invoiceDate: string
  status: string
}

const currencySymbol = (currency: string) => {
  if (currency === 'GBP') return '£'
  if (currency === 'EUR') return '€'
  return '$'
}

export default function EditDealForm({ deal, clients, talents }: EditDealFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // Deal state
  const [title, setTitle] = useState(deal.title)
  const [clientId, setClientId] = useState(deal.clientId)
  const [talentId, setTalentId] = useState(deal.talentId)
  const [commissionRate, setCommissionRate] = useState(deal.commissionRate)
  const [currency, setCurrency] = useState(deal.currency)
  const [stage, setStage] = useState(deal.stage)
  const [activationChecklist, setActivationChecklist] = useState<ReadinessItem[] | null>(null)
  const [ackWarnings, setAckWarnings] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const errorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message
    return 'Failed to update deal. Please check your inputs.'
  }

  // Milestones state
  const initialTotalGross = deal.milestones.reduce((sum, milestone) => sum + (Number(milestone.grossAmount) || 0), 0)
  const [grossJobValue, setGrossJobValue] = useState(initialTotalGross > 0 ? String(Math.round(initialTotalGross)) : '')
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(deal.milestones.map(m => ({
    id: m.id,
    description: m.description,
    grossAmount: String(Math.round(Number(m.grossAmount) || 0)),
    percentage: initialTotalGross > 0 ? String(Math.round((Number(m.grossAmount) / initialTotalGross) * 100)) : '',
    invoiceDate: new Date(m.invoiceDate).toISOString().split('T')[0],
    status: m.status
  })))

  const addMilestone = () => {
    setMilestones([...milestones, {
      id: '', // New milestones have no ID
      description: '',
      grossAmount: '',
      percentage: '',
      invoiceDate: '',
      status: 'PENDING'
    }])
  }

  const removeMilestone = (index: number) => {
    const m = milestones[index]
    if (m.status !== 'PENDING') {
      setFormError('Cannot remove a milestone that is already complete or invoiced.')
      return
    }
    setMilestones(milestones.filter((_, i) => i !== index))
  }

  const updateMilestoneField = (index: number, field: 'description' | 'grossAmount' | 'percentage' | 'invoiceDate', value: string) => {
    const m = milestones[index]
    if (m.id && m.status !== 'PENDING') return // Lock completed milestones

    const newMilestones = [...milestones]
    const current = newMilestones[index]
    const total = Number(grossJobValue) || 0
    if (field === 'grossAmount') {
      const amount = Math.round(Number(value) || 0)
      const percentage = total > 0 ? String(Math.round((amount / total) * 100)) : ''
      newMilestones[index] = { ...current, grossAmount: amount > 0 ? String(amount) : '', percentage }
    } else if (field === 'percentage') {
      const pct = Math.round(Number(value) || 0)
      const grossAmount = total > 0 ? String(Math.round((total * pct) / 100)) : current.grossAmount
      newMilestones[index] = { ...current, percentage: pct > 0 ? String(pct) : '', grossAmount }
    } else {
      newMilestones[index] = { ...current, [field]: value }
    }
    setMilestones(newMilestones)
  }

  const totalMilestoneAmount = milestones.reduce((sum, milestone) => sum + (Number(milestone.grossAmount) || 0), 0)
  const totalMilestonePercentage = milestones.reduce((sum, milestone) => sum + (Number(milestone.percentage) || 0), 0)

  const submitDealUpdate = async (acknowledgedWarningIds?: string[]) => {
    setFormError(null)
    try {
      const res = await updateDeal({
        dealId: deal.id,
        title,
        clientId,
        talentId,
        commissionRate: parseFloat(commissionRate),
        currency,
        stage: stage as DealStage,
        acknowledgedWarningIds,
        milestones: milestones.map(m => ({
          id: m.id || undefined,
          description: m.description,
          grossAmount: parseFloat(m.grossAmount),
          invoiceDate: m.invoiceDate,
        }))
      })

      if (res.success) {
        router.push(`/agency/pipeline/${deal.id}`)
      }
    } catch (err) {
      console.error('[EditDealForm] updateDeal failed', err)
      setFormError(errorMessage(err))
      throw err
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const roundedGrossJobValue = Math.round(Number(grossJobValue) || 0)
    if (roundedGrossJobValue > 0) {
      if (Math.round(totalMilestoneAmount) !== roundedGrossJobValue) {
        setFormError(`Milestone amounts must total exactly ${currencySymbol(currency)}${roundedGrossJobValue}.`)
        return
      }
      if (Math.round(totalMilestonePercentage) !== 100) {
        setFormError('Milestone split percentages must total exactly 100%.')
        return
      }
    }
    setLoading(true)
    const requiresActivationReadiness = deal.stage !== 'ACTIVE' && stage === 'ACTIVE'
    if (requiresActivationReadiness) {
      try {
        const checklist = await getDealActivationReadiness(deal.id)
        setActivationChecklist(checklist)
        setAckWarnings(false)
      } catch (err) {
        console.error('[EditDealForm] getDealActivationReadiness failed', err)
        setFormError(errorMessage(err))
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      await submitDealUpdate()
    } catch {
      // submitDealUpdate already populated formError
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmActivation = async () => {
    if (!activationChecklist) return
    const warningIds = activationChecklist.filter((item) => item.status === 'warn').map((item) => item.id)
    setLoading(true)
    try {
      await submitDealUpdate(warningIds)
      setActivationChecklist(null)
      setAckWarnings(false)
    } catch {
      // submitDealUpdate already populated formError
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500">
      {formError ? (
        <div
          role="alert"
          aria-live="polite"
          data-testid="edit-deal-error"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {formError}
        </div>
      ) : null}
      {/* Section 1: Deal Information */}
      <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 text-black">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
          Deal Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 md:col-span-1">
            <label htmlFor="edit-deal-title" className="text-sm font-medium text-gray-700">Deal Title</label>
            <input
              id="edit-deal-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-deal-stage" className="text-sm font-medium text-gray-700">Pipeline Stage</label>
            <select
              id="edit-deal-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              disabled={deal.stage === 'IN_BILLING' || deal.stage === 'COMPLETED'}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {stageOptionsFor(deal.stage as DealStage).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {(deal.stage === 'IN_BILLING' || deal.stage === 'COMPLETED') && (
              <p className="text-xs text-gray-500">
                Stage is system-controlled once a deal enters billing. Further movement happens automatically as milestones invoice and settle.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-deal-client" className="text-sm font-medium text-gray-700">Select Client</label>
            <select
              id="edit-deal-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-deal-talent" className="text-sm font-medium text-gray-700">Select Talent</label>
            <select
              id="edit-deal-talent"
              value={talentId}
              onChange={(e) => setTalentId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {talents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-deal-commission" className="text-sm font-medium text-gray-700">Commission Rate (%)</label>
            <input
              id="edit-deal-commission"
              required
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-deal-currency" className="text-sm font-medium text-gray-700">Currency</label>
            <select
              id="edit-deal-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label htmlFor="edit-deal-gross-value" className="text-sm font-medium text-gray-700">Gross Job Value ({currencySymbol(currency)})</label>
            <input
              id="edit-deal-gross-value"
              type="number"
              value={grossJobValue}
              onChange={(e) => setGrossJobValue(e.target.value)}
              step={1}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Milestones */}
      <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 text-black">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
            Milestones
          </h2>
          <button 
            type="button"
            onClick={addMilestone}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            + Add Milestone
          </button>
        </div>

        <div className="space-y-3 text-xs text-gray-500">
          <p>
            Split summary: {currencySymbol(currency)}{Math.round(totalMilestoneAmount)} allocated
            {grossJobValue ? ` of ${currencySymbol(currency)}${Math.round(Number(grossJobValue) || 0)}` : ''} ·{' '}
            {Math.round(totalMilestonePercentage)}%
          </p>
        </div>

        <div className="space-y-4">
          {milestones.map((m, index) => {
            const isLocked = m.id && m.status !== 'PENDING'
            return (
              <div key={index} className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 rounded-xl border flex items-end ${isLocked ? 'bg-gray-100 border-gray-200 opacity-75' : 'bg-gray-50 border-gray-100'}`}>
                <div className="md:col-span-1.5 space-y-1.5 text-black">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    Description
                    {isLocked && <span className="bg-gray-200 px-1.5 py-0.5 rounded text-[8px] border border-gray-300">LOCKED</span>}
                  </label>
                  <input 
                    required
                    disabled={!!isLocked}
                    value={m.description}
                    onChange={(e) => updateMilestoneField(index, 'description', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md outline-none disabled:bg-gray-50"
                  />
                </div>
                <div className="space-y-1.5 text-black">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gross Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">{currencySymbol(currency)}</span>
                    <input 
                      required
                      disabled={!!isLocked}
                      type="number"
                      step={1}
                      value={m.grossAmount}
                      onChange={(e) => updateMilestoneField(index, 'grossAmount', e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-gray-200 rounded-md outline-none font-mono disabled:bg-gray-50"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 text-black">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Split %</label>
                  <input
                    disabled={!!isLocked}
                    type="number"
                    step={1}
                    value={m.percentage}
                    onChange={(e) => updateMilestoneField(index, 'percentage', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md outline-none font-mono disabled:bg-gray-50"
                  />
                </div>
                <div className="space-y-1.5 text-black">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoice Date</label>
                  <input 
                    required
                    disabled={!!isLocked}
                    type="date"
                    value={m.invoiceDate}
                    onChange={(e) => updateMilestoneField(index, 'invoiceDate', e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md outline-none disabled:bg-gray-50"
                  />
                </div>
                <div className="flex justify-end pb-1.5">
                  <button 
                    type="button"
                    onClick={() => removeMilestone(index)}
                    disabled={isLocked || milestones.length === 1}
                    className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-0 transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="flex items-center justify-end gap-4">
        <button 
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button 
          disabled={loading}
          type="submit"
          className="px-8 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
    {activationChecklist ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white border border-gray-200 shadow-xl">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="text-lg font-bold text-gray-900">Readiness Check: Move to Active</h3>
            <p className="text-sm text-gray-500 mt-1">{title}</p>
          </div>
          <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {activationChecklist.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  item.status === 'pass'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : item.status === 'warn'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                <span className="mr-2">
                  {item.status === 'pass' ? '✓' : item.status === 'warn' ? '⚠' : '✗'}
                </span>
                {item.message}
              </div>
            ))}

            {activationChecklist.some((item) => item.status === 'warn') ? (
              <label className="flex items-start gap-2 text-sm text-gray-700 pt-2">
                <input
                  type="checkbox"
                  checked={ackWarnings}
                  onChange={(e) => setAckWarnings(e.target.checked)}
                  className="mt-0.5"
                />
                I acknowledge all warnings and want to continue activation.
              </label>
            ) : null}
          </div>
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setActivationChecklist(null)
                setAckWarnings(false)
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmActivation}
              disabled={
                loading ||
                activationChecklist.some((item) => item.status === 'block') ||
                (activationChecklist.some((item) => item.status === 'warn') && !ackWarnings)
              }
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Activating...' : 'Confirm Move to Active'}
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}
