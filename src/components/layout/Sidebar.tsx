'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuthMe } from '@/hooks/useAuthMe';
import { Logo } from './Logo';
import SignOutButton from './SignOutButton';

const NavLink = ({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href}
      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive 
          ? 'text-blue-900 bg-blue-50' 
          : 'text-zinc-600 hover:text-blue-900 hover:bg-blue-50/50'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
};

const Icons = {
  Dashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Deals: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Talent: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Clients: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  VAT: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  SignOut: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
};

export default function Sidebar() {
  const user = useAuthMe();
  const role = user?.role;
  const isAdmin = role === 'AGENCY_ADMIN';

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/agency/pipeline" className="flex items-center gap-2 text-zinc-900 dark:text-white">
          <Logo className="text-2xl" />
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink href="/agency/dashboard" icon={Icons.Dashboard}>Dashboard</NavLink>
        <NavLink href="/agency/pipeline" icon={Icons.Deals}>Deals</NavLink>
        <NavLink href="/agency/talent-roster" icon={Icons.Talent}>Talent</NavLink>
        <NavLink href="/agency/clients" icon={Icons.Clients}>Clients</NavLink>
        <NavLink href="/agency/vat-monitor" icon={Icons.VAT}>VAT Monitor</NavLink>
      </nav>
      
      <div className="p-4 border-t border-zinc-200 space-y-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-white shadow-sm border border-zinc-100">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white font-semibold shadow-inner shrink-0 text-sm">
            {user?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-zinc-900 truncate">{user?.email?.split('@')[0] || 'Agency User'}</span>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">{isAdmin ? 'Admin' : 'Agent'}</span>
          </div>
        </div>

        <SignOutButton
          className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-600 rounded-md hover:text-red-700 hover:bg-red-50 transition-colors"
          toastClassName="border-blue-300/50 bg-blue-500/15 text-blue-700"
          icon={Icons.SignOut}
        />
      </div>
    </aside>
  );
}
