'use client'

import React, { useState } from 'react'
import ExpensesSection from './ExpensesSection'
import AddExpenseForm from './AddExpenseForm'

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

export default function DealExpensesContainer({ 
  expenses, 
  dealId, 
  agencyId,
  currency
}: { 
  expenses: any[], 
  dealId: string,
  agencyId: string,
  currency: string
}) {
  const [showAddForm, setShowAddForm] = useState(false)

  const formatCurrency = (amount: any) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(Number(amount))
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  }

  return (
    <>
      <ExpensesSection 
        expenses={expenses}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        onAddClick={() => setShowAddForm(true)}
      />


      {showAddForm && (
        <AddExpenseForm 
          dealId={dealId}
          agencyId={agencyId}
          currency={currency}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </>
  )
}
