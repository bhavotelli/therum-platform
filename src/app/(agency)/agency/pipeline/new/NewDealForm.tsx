'use client'

import { useState } from 'react'
import { createDeal } from '../actions'
import { DealStage } from '@prisma/client'

type MilestoneDraft = {
  description: string
  grossAmount: string
  percentage: string
  invoiceDate: string
}

const currencySymbol = (currency: string) => {
  if (currency === 'GBP') return '£'
  if (currency === 'EUR') return '€'
  return '$'
}

interface NewDealFormProps {
  agencyId: string
  clients: { id: string; name: string }[]
  talents: { id: string; name: string }[]
}

export default function NewDealForm({ agencyId, clients, talents }: NewDealFormProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(clients[0]?.id || '')
  const [talentId, setTalentId] = useState(talents[0]?.id || '')
  const [commissionRate, setCommissionRate] = useState('20')
  const [currency, setCurrency] = useState('GBP')
  const [stage, setStage] = useState('PIPELINE')
  const [grossJobValue, setGrossJobValue] = useState('')
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { description: 'Initial Milestone', grossAmount: '', percentage: '', invoiceDate: '' }
  ])

  const addMilestone = () => {
    setMilestones([...milestones, { description: '', grossAmount: '', percentage: '', invoiceDate: '' }])
  }

  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index))
    }
  }

  const updateMilestone = (index: number, field: 'description' | 'grossAmount' | 'percentage' | 'invoiceDate', value: string) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const roundedGrossJobValue = Math.round(Number(grossJobValue) || 0)
    if (roundedGrossJobValue > 0) {
      if (Math.round(totalMilestoneAmount) !== roundedGrossJobValue) {
        alert(`Milestone amounts must total exactly ${currencySymbol(currency)}${roundedGrossJobValue}.`)
        return
      }
      if (Math.round(totalMilestonePercentage) !== 100) {
        alert('Milestone split percentages must total exactly 100%.')
        return
      }
    }
    setLoading(true)

    try {
      await createDeal({
        agencyId,
        clientId,
        talentId,
        title,
        commissionRate: parseFloat(commissionRate),
        currency,
        stage: stage as DealStage,
        milestones: milestones.map(m => ({
          description: m.description,
          grossAmount: parseFloat(m.grossAmount),
          invoiceDate: m.invoiceDate,
        }))
      })
    } catch (err) {
      console.error(err)
      alert('Failed to create deal. Please check your inputs.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in duration-500">
      {/* Section 1: Deal Information */}
      <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
          Deal Information
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Deal Title</label>
            <input 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Summer Brand Campaign 2026"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Select Client</label>
            <select 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Select Talent</label>
            <select 
              value={talentId}
              onChange={(e) => setTalentId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {talents.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Commission Rate (%)</label>
            <input 
              required
              type="number"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Currency</label>
            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Pipeline Stage</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="PIPELINE">Prospect</option>
              <option value="NEGOTIATING">Negotiating</option>
              <option value="CONTRACTED">Contracting</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Gross Job Value ({currencySymbol(currency)})</label>
            <input
              type="number"
              value={grossJobValue}
              onChange={(e) => setGrossJobValue(e.target.value)}
              step={1}
              placeholder="Optional: set total to split milestones by %"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Milestones */}
      <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
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
          {milestones.map((m, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-end">
              <div className="md:col-span-1.5 space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
                <input 
                  required
                  value={m.description}
                  onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                  placeholder="e.g. Deposit"
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Gross Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">{currencySymbol(currency)}</span>
                  <input 
                    required
                    type="number"
                    step={1}
                    value={m.grossAmount}
                    onChange={(e) => updateMilestone(index, 'grossAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Split %</label>
                <input
                  type="number"
                  step={1}
                  value={m.percentage}
                  onChange={(e) => updateMilestone(index, 'percentage', e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Invoice Date</label>
                <input 
                  required
                  type="date"
                  value={m.invoiceDate}
                  onChange={(e) => updateMilestone(index, 'invoiceDate', e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex justify-end pb-1.5">
                <button 
                  type="button"
                  onClick={() => removeMilestone(index)}
                  disabled={milestones.length === 1}
                  className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-0 transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
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
          {loading ? 'Creating...' : 'Create Deal'}
        </button>
      </div>
    </form>
  )
}
