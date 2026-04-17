'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
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
          ? 'text-purple-900 bg-purple-50' 
          : 'text-zinc-600 hover:text-purple-900 hover:bg-purple-50/50'
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
  Earnings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Documents: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Profile: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  SignOut: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
};

type TalentSidebarProps = {
  basePath?: string;
  previewMode?: boolean;
};

export default function TalentSidebar({ basePath = '/talent', previewMode = false }: TalentSidebarProps) {
  const { data: session } = useSession();
  const dashboardHref = `${basePath}/dashboard`;
  const dealsHref = `${basePath}/deals`;
  const earningsHref = `${basePath}/earnings`;
  const documentsHref = `${basePath}/documents`;
  const profileHref = `${basePath}/profile`;
  
  return (
    <aside className="w-full lg:w-64 lg:h-screen bg-zinc-50 border-b lg:border-b-0 lg:border-r border-purple-100 flex flex-col lg:sticky lg:top-0">
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href={dashboardHref} className="flex items-center gap-2 text-zinc-900 dark:text-white">
          <Logo className="text-2xl" />
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700 uppercase tracking-widest border border-purple-200">
            {previewMode ? 'Preview' : 'Talent'}
          </span>
        </Link>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink href={dashboardHref} icon={Icons.Dashboard}>Dashboard</NavLink>
        <NavLink href={dealsHref} icon={Icons.Deals}>My Deals</NavLink>
        <NavLink href={earningsHref} icon={Icons.Earnings}>Earnings</NavLink>
        <NavLink href={documentsHref} icon={Icons.Documents}>Documents</NavLink>
        <NavLink href={profileHref} icon={Icons.Profile}>My Profile</NavLink>
      </nav>
      
      <div className="p-4 border-t border-purple-100 space-y-3">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-white shadow-sm border border-purple-50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-inner shrink-0 text-sm">
            {session?.user?.name?.charAt(0) || 'T'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-zinc-900 truncate">{session?.user?.name || 'Talent User'}</span>
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-tight">
              {previewMode ? 'Talent Preview' : 'Talent Portal'}
            </span>
          </div>
        </div>
        {previewMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
            Read-only preview for agency testing.
          </div>
        )}
        
        <SignOutButton
          className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-600 rounded-md hover:text-red-700 hover:bg-red-50 transition-colors"
          toastClassName="border-purple-300/50 bg-purple-500/15 text-purple-700"
          icon={Icons.SignOut}
        />
      </div>
    </aside>
  );
}
