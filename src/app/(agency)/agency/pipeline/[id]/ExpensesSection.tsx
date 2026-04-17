'use client'

import React from 'react'

interface ExpenseProps {
  id: string
  description: string
  category: string
  amount: string
  currency: string
  incurredBy: string
  rechargeable: boolean
  contractSignOff: boolean
  status: string
  createdAt: string
  approvedBy?: {
    firstName: string
    lastName: string
  } | null
}

export default function ExpensesSection({ 
  expenses, 
  formatCurrency, 
  formatDate,
  onAddClick
}: { 
  expenses: ExpenseProps[], 
  formatCurrency: (amount: any) => string,
  formatDate: (date: Date) => string,
  onAddClick: () => void
}) {
  return (
    <section className="space-y-6 pt-4 text-black">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Deal Expenses</h2>
        <button 
          onClick={onAddClick}
          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Expense
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="text-center py-20 text-gray-500 border-2 border-dashed border-gray-200 rounded-3xl bg-white shadow-sm">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="font-medium text-gray-900">No expenses logged yet</p>
          <p className="text-sm mt-1">Rechargeable expenses will be automatically added to client invoices.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] uppercase bg-gray-50 text-gray-400 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-black tracking-widest">Description / Category</th>
                <th className="px-6 py-4 font-black tracking-widest">Amount</th>
                <th className="px-6 py-4 font-black tracking-widest text-center">Rechargeable</th>
                <th className="px-6 py-4 font-black tracking-widest text-center">Status</th>
                <th className="px-6 py-4 font-black tracking-widest">Date Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map((expense) => (
                <tr key={expense.id} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900 uppercase tracking-tight">{expense.description}</div>
                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{expense.category}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-gray-900">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      {expense.rechargeable ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border border-blue-200 bg-blue-50 text-blue-700">Yes</span>
                          {!expense.contractSignOff && (
                            <span className="text-[8px] text-amber-600 font-black uppercase flex items-center gap-0.5">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Needs Sign-off
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase border border-gray-200 bg-gray-50 text-gray-400">No</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                     <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${
                        expense.status === 'INVOICED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        expense.status === 'APPROVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-gray-50 text-gray-600 border-gray-200'
                     }`}>
                        {expense.status}
                     </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-500">
                    {formatDate(new Date(expense.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
