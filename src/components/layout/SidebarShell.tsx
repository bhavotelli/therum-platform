'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type SidebarCtx = { collapsed: boolean; toggle: () => void }

const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} })

export function useSidebar() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (localStorage.getItem('sidebar_collapsed') === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <SidebarContext.Provider value={{ collapsed: mounted ? collapsed : false, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function SidebarContent({ children, className }: { children: ReactNode; className?: string }) {
  const { collapsed } = useSidebar()
  return (
    <div className={`flex-1 transition-[padding] duration-200 ease-in-out ${collapsed ? 'lg:pl-16' : 'lg:pl-64'} ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function TalentSidebarShell({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div className={`flex min-h-0 flex-1 lg:grid transition-[grid-template-columns] duration-200 ease-in-out ${collapsed ? 'lg:grid-cols-[4rem_minmax(0,1fr)]' : 'lg:grid-cols-[16rem_minmax(0,1fr)]'}`}>
      {children}
    </div>
  )
}
