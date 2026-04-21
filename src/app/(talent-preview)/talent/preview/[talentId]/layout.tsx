import { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import TalentSidebar from '@/components/layout/TalentSidebar'
import { SidebarProvider, TalentSidebarShell } from '@/components/layout/SidebarShell'
import { resolveAppUser } from '@/lib/auth/resolve-app-user'
import { getSupabaseServiceRole } from '@/lib/supabase/service'

type PreviewLayoutProps = {
  children: ReactNode
  params: Promise<{ talentId: string }>
}

export default async function TalentPreviewLayout({ children, params }: PreviewLayoutProps) {
  const appUser = await resolveAppUser()
  const role = appUser?.role
  const userId = appUser?.id
  const { talentId } = await params

  if (!appUser || !role || !userId) {
    redirect('/login')
  }

  if (!['SUPER_ADMIN', 'AGENCY_ADMIN', 'AGENT'].includes(role)) {
    redirect('/login?notice=Talent+preview+is+for+agency+testers+only')
  }

  const db = getSupabaseServiceRole()
  const [{ data: viewer, error: vErr }, { data: talent, error: tErr }] = await Promise.all([
    db.from('User').select('agencyId').eq('id', userId).maybeSingle(),
    db.from('Talent').select('id, name, agencyId').eq('id', talentId).maybeSingle(),
  ])
  if (vErr) throw new Error(vErr.message)
  if (tErr) throw new Error(tErr.message)

  if (!talent) {
    redirect('/agency/talent-roster')
  }

  if (role !== 'SUPER_ADMIN' && (!viewer?.agencyId || viewer.agencyId !== talent.agencyId)) {
    redirect('/agency/pipeline')
  }

  try {
    const { error } = await db.from('PreviewLog').insert({
      previewedBy: userId,
      talentId: talent.id,
      agencyId: talent.agencyId,
    })
    if (error) console.warn('[preview layout] PreviewLog insert:', error.message)
  } catch {
    // no-op
  }

  const basePath = `/talent/preview/${talentId}`

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-white text-zinc-900">
        <TalentSidebarShell>
          <TalentSidebar basePath={basePath} previewMode />
          <div className="min-w-0 flex flex-col">
            <main className="flex-1 overflow-y-auto p-8">
              <div className="w-full space-y-8">
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Talent Portal Preview</p>
                  <p className="mt-1 text-sm font-medium text-amber-900">
                    Viewing as {talent.name}. This mode is read-only for beta testing by agency users.
                  </p>
                </div>
                {children}
              </div>
            </main>
          </div>
        </TalentSidebarShell>
      </div>
    </SidebarProvider>
  )
}
