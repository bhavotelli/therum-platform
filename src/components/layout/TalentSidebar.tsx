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
  const activeClass = 'text-purple-900 bg-purple-50';
  const idleClass = 'text-zinc-600 hover:text-purple-900 hover:bg-purple-50/50';

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
  Deals: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Earnings: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Documents: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Profile: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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

type TalentSidebarProps = {
  basePath?: string;
  previewMode?: boolean;
};

export default function TalentSidebar({ basePath = '/talent', previewMode = false }: TalentSidebarProps) {
  const user = useAuthMe();
  const { collapsed, toggle } = useSidebar();
  const dashboardHref = `${basePath}/dashboard`;
  const dealsHref = `${basePath}/deals`;
  const earningsHref = `${basePath}/earnings`;
  const documentsHref = `${basePath}/documents`;
  const profileHref = `${basePath}/profile`;

  return (
    <aside
      className={`w-full bg-zinc-50 border-b lg:border-b-0 lg:border-r border-purple-100 flex flex-col lg:h-screen lg:sticky lg:top-0 transition-[width] duration-200 ease-in-out overflow-hidden ${collapsed ? 'lg:w-16' : 'lg:w-64'}`}
    >
      <div className="flex h-16 shrink-0 items-center px-4 overflow-hidden">
        <Link href={dashboardHref} className="flex items-center gap-2 text-zinc-900 min-w-0">
          {/*
            Talent sidebar collapses only at lg+; on narrow viewports the
            sidebar stacks above content at full width, so we want the
            full wordmark regardless of `collapsed`. Guard against
            rendering "t" when we're not actually in the collapsed-rail
            state visually.
          */}
          <span className="hidden lg:inline">
            <Logo className="text-2xl" collapsed={collapsed} />
          </span>
          <span className="lg:hidden">
            <Logo className="text-2xl" />
          </span>
          {!collapsed && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-700 uppercase tracking-widest border border-purple-200 shrink-0">
              {previewMode ? 'Preview' : 'Talent'}
            </span>
          )}
        </Link>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        <NavLink href={dashboardHref} icon={Icons.Dashboard} label="Dashboard" collapsed={collapsed} />
        <NavLink href={dealsHref} icon={Icons.Deals} label="My Deals" collapsed={collapsed} />
        <NavLink href={earningsHref} icon={Icons.Earnings} label="Earnings" collapsed={collapsed} />
        <NavLink href={documentsHref} icon={Icons.Documents} label="Documents" collapsed={collapsed} />
        <NavLink href={profileHref} icon={Icons.Profile} label="My Profile" collapsed={collapsed} />

        <div className="pt-2 mt-2 border-t border-purple-100 hidden lg:block">
          <button
            onClick={toggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center w-10 h-8 mx-auto rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            {collapsed ? Icons.ChevronRight : Icons.ChevronLeft}
          </button>
        </div>
      </nav>

      <div className={`border-t border-purple-100 space-y-3 ${collapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-white shadow-sm border border-purple-50 ${collapsed ? 'lg:justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold shadow-inner shrink-0 text-xs">
            {user?.name?.charAt(0) || 'T'}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-zinc-900 truncate">{user?.name || 'Talent User'}</span>
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-tight">
                {previewMode ? 'Talent Preview' : 'Talent Portal'}
              </span>
            </div>
          )}
        </div>

        {previewMode && !collapsed && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
            Read-only preview for agency testing.
          </div>
        )}

        <SignOutButton
          className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-600 rounded-md hover:text-red-700 hover:bg-red-50 transition-colors ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}
          toastClassName="border-purple-300/50 bg-purple-500/15 text-purple-700"
          icon={Icons.SignOut}
          label={collapsed ? '' : 'Sign Out'}
        />
      </div>
    </aside>
  );
}
