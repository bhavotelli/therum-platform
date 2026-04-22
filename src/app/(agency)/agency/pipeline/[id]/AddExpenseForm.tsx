'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { addExpense } from './actions'

export default function AddExpenseForm({ 
  dealId, 
  agencyId, 
  currency,
  onClose 
}: { 
  dealId: string, 
  agencyId: string,
  currency: string,
  onClose: () => void 
}) {
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('TRAVEL')
  const [amount, setAmount] = useState('')
  const [rechargeable, setRechargeable] = useState(false)
  const [contractSignOff, setContractSignOff] = useState(false)
  const [incurredBy, setIncurredBy] = useState('AGENCY')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await addExpense({
        dealId,
        agencyId,
        description,
        category,
        amount: parseFloat(amount),
        currency,
        rechargeable,
        contractSignOff,
        incurredBy
      })
      toast.success('Expense logged')
      onClose()
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Failed to add expense.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 text-black">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900">Log New Expense</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <input 
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Return flight to London"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="TRAVEL">Travel</option>
                  <option value="ACCOMMODATION">Accommodation</option>
                  <option value="PRODUCTION">Production</option>
                  <option value="USAGE_RIGHTS">Usage Rights</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Amount ({currency})</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Incurred By</label>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-200">
                  <input type="radio" name="incurredBy" value="AGENCY" checked={incurredBy === 'AGENCY'} onChange={() => setIncurredBy('AGENCY')} className="sr-only" />
                  <span className="text-sm font-bold uppercase tracking-wider">Agency</span>
                </label>
                <label className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-200">
                  <input type="radio" name="incurredBy" value="TALENT" checked={incurredBy === 'TALENT'} onChange={() => setIncurredBy('TALENT')} className="sr-only" />
                  <span className="text-sm font-bold uppercase tracking-wider">Talent</span>
                </label>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={rechargeable}
                    onChange={(e) => setRechargeable(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Recharge to Client?</div>
                  <p className="text-[10px] text-gray-500 font-medium">If checked, this will be added to the next invoice.</p>
                </div>
              </label>

              {rechargeable && (
                <label className="flex items-center gap-3 cursor-pointer group animate-in slide-in-from-left-2 duration-300">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={contractSignOff}
                      onChange={(e) => setContractSignOff(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Contract Sign-off Received?</div>
                    <p className="text-[10px] text-gray-500 font-medium">Verify if the brand has already approved this expense.</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="pt-6 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={loading}
              type="submit"
              className="flex-[2] px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
