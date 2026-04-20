'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuthMe } from '@/hooks/useAuthMe';
import { Logo } from './Logo';
import SignOutButton from './SignOutButton';
import { useSidebar } from './SidebarShell';

const NavLink = ({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) => {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');
  const activeClass = 'text-teal-900 bg-teal-50';
  const idleClass = 'text-zinc-600 hover:text-teal-900 hover:bg-teal-50/50';

  if (collapsed) {
    return (
      <Link
        href={href}
        title={label}
        className={`flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-colors ${isActive ? activeClass : idleClass}`}
      >
        {icon}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? activeClass : idleClass}`}
    >
      {icon}
      {label}
    </Link>
  );
};

const Icons = {
  Dashboard: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Queue: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  CreditNotes: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Overdue: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Expenses: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5 12h5A2.5 2.5 0 0017 17.5v-11A2.5 2.5 0 0014.5 4h-5A2.5 2.5 0 007 6.5v11A2.5 2.5 0 009.5 20z" />
    </svg>
  ),
  Payouts: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  VAT: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Sync: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Settings: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  SignOut: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  ChevronLeft: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  ),
  ChevronRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
};

export default function FinanceSidebar() {
  const user = useAuthMe();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`fixed inset-y-0 left-0 bg-zinc-50 border-r border-teal-100 flex flex-col transition-[width] duration-200 ease-in-out overflow-hidden ${collapsed ? 'w-16' : 'w-64'}`}
    >
      <div className="flex h-16 shrink-0 items-center px-4 overflow-hidden">
        <Link href="/finance/dashboard" className="flex items-center gap-2 text-zinc-900 min-w-0">
          {collapsed ? (
            <span className="font-logo font-bold text-2xl tracking-tight lowercase">t</span>
          ) : (
            <>
              <Logo className="text-2xl" />
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-teal-100 text-teal-700 uppercase tracking-widest border border-teal-200 shrink-0">
                Finance
              </span>
            </>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <NavLink href="/finance/dashboard" icon={Icons.Dashboard} label="Dashboard" collapsed={collapsed} />
        <NavLink href="/finance/deals" icon={Icons.Queue} label="Deals (Read-only)" collapsed={collapsed} />
        <NavLink href="/finance/invoices" icon={Icons.Queue} label="Invoice Queue" collapsed={collapsed} />
        <NavLink href="/finance/credit-notes" icon={Icons.CreditNotes} label="Credit Notes" collapsed={collapsed} />
        <NavLink href="/finance/overdue" icon={Icons.Overdue} label="Overdue" collapsed={collapsed} />
        <NavLink href="/finance/expenses" icon={Icons.Expenses} label="Expense Approvals" collapsed={collapsed} />
        <NavLink href="/finance/payouts" icon={Icons.Payouts} label="Payout Centre" collapsed={collapsed} />
        <NavLink href="/finance/vat-compliance" icon={Icons.VAT} label="VAT Compliance" collapsed={collapsed} />
        <NavLink href="/finance/xero-sync" icon={Icons.Sync} label="Xero Sync" collapsed={collapsed} />
        <NavLink href="/finance/settings" icon={Icons.Settings} label="Settings" collapsed={collapsed} />

        <div className="pt-2 mt-2 border-t border-teal-100">
          <button
            onClick={toggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center w-10 h-8 mx-auto rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            {collapsed ? Icons.ChevronRight : Icons.ChevronLeft}
          </button>
        </div>
      </nav>

      <div className={`border-t border-teal-100 space-y-3 ${collapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-white shadow-sm border border-teal-50 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 flex items-center justify-center text-white font-semibold shadow-inner shrink-0 text-xs">
            {user?.name?.charAt(0) || 'F'}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-zinc-900 truncate">{user?.name || 'Finance User'}</span>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-tight">Finance Director</span>
            </div>
          )}
        </div>

        <SignOutButton
          className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-600 rounded-md hover:text-red-700 hover:bg-red-50 transition-colors ${collapsed ? 'justify-center px-2' : ''}`}
          toastClassName="border-teal-300/50 bg-teal-500/15 text-teal-700"
          icon={Icons.SignOut}
          label={collapsed ? '' : 'Sign Out'}
        />
      </div>
    </aside>
  );
}
