import FinanceSidebar from '@/components/layout/FinanceSidebar'
import { SidebarProvider, SidebarContent } from '@/components/layout/SidebarShell'
import { redirect } from 'next/navigation'
import { resolveFinancePageContext } from '@/lib/financeAuth'

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const financeCtx = await resolveFinancePageContext()
  if (financeCtx.status === 'need_login') {
    redirect('/login')
  }
  if (financeCtx.status === 'need_impersonation') {
    redirect(
      '/admin?notice=' +
        encodeURIComponent('Choose an agency in the Super Admin bar to view finance for that tenant.'),
    )
  }

  const showReadOnlyFinance =
    financeCtx.status === 'ok' && financeCtx.impersonatingReadOnly

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-white text-zinc-900 flex flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="print:hidden">
            <FinanceSidebar />
          </div>
          <SidebarContent className="flex flex-col print:!pl-0">
            <main className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible">
              <div className="max-w-6xl mx-auto space-y-8 print:max-w-none print:mx-0">
                {showReadOnlyFinance ? (
                  <div className="print:hidden rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    Super Admin read-only view — invoice and finance mutations are disabled. Use a finance login to
                    perform changes.
                  </div>
                ) : null}
                {children}
              </div>
            </main>
          </SidebarContent>
        </div>
      </div>
    </SidebarProvider>
  )
}
