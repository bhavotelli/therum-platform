'use client'

import React, { useState } from 'react'
import DealsClientTable from './DealsClientTable'
import DealsKanbanView from './DealsKanbanView'

type DealProps = {
  id: string;
  title: string;
  client: string;
  talent: string;
  stage: string;
  probability: number;
  milestonesCount: number;
  completedCount: number;
  isCompleted: boolean;
  progressPercentage: number;
  milestoneRedCount: number;
  milestoneOrangeCount: number;
  milestoneGreenCount: number;
  billedCount: number;
  paidCount: number;
  billingProgressPercentage: number;
  billingState: 'NOT_STARTED' | 'BILLED' | 'PAID';
  totalValue: number;
  weightedValue: number;
};

export default function DealsViewManager({ deals }: { deals: DealProps[] }) {
  const [view, setView] = useState<'table' | 'kanban'>('kanban')

  return (
    <div className="flex flex-col bg-white">
      {/* View Switcher Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setView('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              view === 'kanban' 
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Kanban
          </button>
          <button 
            onClick={() => setView('table')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              view === 'table' 
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Table
          </button>
        </div>
        
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
          Mode: {view === 'table' ? 'List View' : 'Pipeline View'}
        </div>
      </div>

      {/* Render View */}
      <div className="flex-1 overflow-hidden">
        {view === 'table' ? (
          <DealsClientTable deals={deals} />
        ) : (
          <DealsKanbanView deals={deals} />
        )}
      </div>
    </div>
  )
}
