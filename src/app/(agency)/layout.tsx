import Sidebar from "@/components/layout/Sidebar";
import { cookies } from 'next/headers'

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const impersonationRaw = (await cookies()).get('therum_impersonation')?.value
  let isReadOnlyImpersonation = false
  try {
    const parsed = impersonationRaw ? JSON.parse(impersonationRaw) : null
    isReadOnlyImpersonation = Boolean(parsed?.readOnly)
  } catch {
    isReadOnlyImpersonation = false
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex">
      <Sidebar />
      <div className="flex-1 lg:pl-64 flex flex-col">
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
      </div>
    </div>
  );
}
