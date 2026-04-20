import Sidebar from '@/components/layout/Sidebar'
import { SidebarProvider, SidebarContent } from '@/components/layout/SidebarShell'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveAgencyPageContext } from '@/lib/agencyAuth'

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const agencyCtx = await resolveAgencyPageContext()
  if (agencyCtx.status === 'need_impersonation') {
    redirect(
      '/admin?notice=' +
        encodeURIComponent('Choose an agency in the Super Admin bar to open the agency portal.'),
    )
  }

  const impersonationRaw = (await cookies()).get('therum_impersonation')?.value
  let isReadOnlyImpersonation = false
  try {
    const parsed = impersonationRaw ? JSON.parse(impersonationRaw) : null
    isReadOnlyImpersonation = Boolean(parsed?.readOnly)
  } catch {
    isReadOnlyImpersonation = false
  }

  return (
    <SidebarProvider>
      <div className="font-sans min-h-screen bg-white text-zinc-900 flex flex-col">
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <SidebarContent className="flex flex-col">
            <main className="flex-1 overflow-y-auto p-8">
              <div className="max-w-6xl mx-auto space-y-8">
                {isReadOnlyImpersonation ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Read-only impersonation mode is active. Deal, milestone, and expense updates are blocked.
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
