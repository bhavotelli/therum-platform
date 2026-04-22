import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DealNumberBadge } from '@/components/deals/DealNumberBadge';

type DealProps = {
  id: string;
  dealNumber: string | null;
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
  invoicedValue: number;
  weightedValue: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value)

export default function DealsClientTable({ deals }: { deals: DealProps[] }) {
  const stageLabel = (stage: string) =>
    stage === 'PIPELINE'
      ? 'PROSPECT'
      : stage === 'CONTRACTED'
        ? 'CONTRACTING'
        : stage === 'IN_BILLING'
          ? 'IN BILLING'
          : stage.replace('_', ' ')

  const router = useRouter();
  
  // Filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  const filteredDeals = useMemo(() => {
    const needle = searchTerm.toLowerCase();
    return deals.filter(deal => {
      const matchesSearch =
        deal.title.toLowerCase().includes(needle) ||
        deal.client.toLowerCase().includes(needle) ||
        deal.talent.toLowerCase().includes(needle) ||
        // Match on dealNumber so finance/agency staff can paste a reference
        // from an email or contract (e.g. "NKE-0042") and jump to the deal.
        (deal.dealNumber?.toLowerCase().includes(needle) ?? false);

      const matchesStage = stageFilter === 'ALL' || deal.stage === stageFilter;

      return matchesSearch && matchesStage;
    });
  }, [deals, searchTerm, stageFilter]);

  if (deals.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500 bg-white">
        No deals found. Create your first deal to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Search and Filters Bar */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by deal number, title, client, or talent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-black"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Stage:</label>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          >
            <option value="ALL">All Stages</option>
            <option value="PIPELINE">Prospect</option>
            <option value="NEGOTIATING">Negotiating</option>
            <option value="CONTRACTED">Contracting</option>
            <option value="ACTIVE">Active</option>
            <option value="IN_BILLING">In Billing</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div className="text-xs text-gray-400 font-medium ml-auto">
          Showing {filteredDeals.length} of {deals.length} deals
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] uppercase bg-gray-50 text-gray-400 border-b border-gray-100">
            <tr>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest">Deal Title</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest">Client / Brand</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest">Talent</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest text-center">Stage</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest text-center">Probability</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest text-right">Deal Value</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest text-right">Weighted Value</th>
              <th scope="col" className="px-6 py-3 font-bold tracking-widest">Milestone Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {filteredDeals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                  No deals match your search criteria.
                </td>
              </tr>
            ) : (
              filteredDeals.map((deal) => (
                <tr
                  key={deal.id}
                  onClick={() => router.push(`/agency/pipeline/${deal.id}`)}
                  className="group hover:bg-indigo-50/30 transition-all duration-200 cursor-pointer"
                >
                  <td className="px-6 py-5">
                    {deal.dealNumber && (
                      <div className="mb-1">
                        <DealNumberBadge dealNumber={deal.dealNumber} />
                      </div>
                    )}
                    <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                      {deal.title}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-tighter">
                      {deal.client}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 uppercase">
                         {deal.talent.charAt(0)}
                       </div>
                       <span className="text-gray-700 font-medium text-xs tracking-tight">{deal.talent}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                      deal.stage === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      deal.stage === 'IN_BILLING' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                      deal.stage === 'ACTIVE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      deal.stage === 'CONTRACTED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      deal.stage === 'NEGOTIATING' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {stageLabel(deal.stage)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border border-indigo-200 bg-indigo-50 text-indigo-700">
                      {Math.round(deal.probability)}%
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-semibold text-gray-800">{formatCurrency(deal.totalValue)}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-semibold text-indigo-700">{formatCurrency(deal.weightedValue)}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                      {deal.stage === 'ACTIVE' && deal.totalValue > 0 && (
                        <>
                          <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Invoiced</span>
                            <span className="text-[10px] font-black text-indigo-600 tabular-nums">
                              {Math.round((deal.invoicedValue / deal.totalValue) * 100)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                              style={{ width: `${Math.round((deal.invoicedValue / deal.totalValue) * 100)}%` }}
                            />
                          </div>
                        </>
                      )}
                      {(deal.stage === 'IN_BILLING' || deal.stage === 'COMPLETED') && deal.milestonesCount > 0 && (
                        <>
                          <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Billing</span>
                            <span className="text-[10px] font-black tabular-nums text-gray-900">
                              {deal.paidCount}/{deal.milestonesCount} paid
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden flex">
                            <div
                              className="h-full bg-rose-400"
                              style={{ width: `${(deal.milestoneRedCount / deal.milestonesCount) * 100}%` }}
                              title={`Not yet invoiced: ${deal.milestoneRedCount}`}
                            />
                            <div
                              className="h-full bg-amber-400"
                              style={{ width: `${(deal.milestoneOrangeCount / deal.milestonesCount) * 100}%` }}
                              title={`Awaiting payment: ${deal.milestoneOrangeCount}`}
                            />
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${(deal.milestoneGreenCount / deal.milestonesCount) * 100}%` }}
                              title={`Paid: ${deal.milestoneGreenCount}`}
                            />
                          </div>
                          <div className="flex gap-3 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
                            {deal.milestoneRedCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                {deal.milestoneRedCount} O/S
                              </span>
                            )}
                            {deal.milestoneOrangeCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {deal.milestoneOrangeCount} Awaiting
                              </span>
                            )}
                            {deal.milestoneGreenCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                {deal.milestoneGreenCount} Paid
                              </span>
                            )}
                          </div>
                        </>
                      )}
                      {!['ACTIVE', 'IN_BILLING', 'COMPLETED'].includes(deal.stage) && (
                        <span className="text-[10px] text-gray-300 uppercase tracking-widest">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

