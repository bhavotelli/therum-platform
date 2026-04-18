import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolveAgencyPageContext } from "@/lib/agencyAuth";

export default async function TalentRosterPage() {
  const agencyCtx = await resolveAgencyPageContext();
  if (agencyCtx.status === "need_login") {
    redirect("/login");
  }
  if (agencyCtx.status === "forbidden" || agencyCtx.status === "need_impersonation") {
    notFound();
  }
  if (agencyCtx.status === "no_agency") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-zinc-600">
        No agency linked to this user yet.
      </div>
    );
  }

  const talents = await prisma.talent.findMany({
    where: { agencyId: agencyCtx.agencyId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900">Talent Roster</h1>
        <Link
          href="/agency/talent-roster/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
        >
          Add Talent
        </Link>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <p className="text-sm font-semibold text-blue-900">Talent Portal Testing</p>
        <p className="mt-1 text-sm text-blue-800">
          During beta, agency users should test portal UX through preview mode rather than asking talent to log in.
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        {talents.length === 0 ? (
          <div className="p-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
            <p className="text-zinc-500 font-medium">Add talent records to begin portal preview testing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {talents.map((talent) => (
              <div key={talent.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div>
                  <Link href={`/agency/talent-roster/${talent.id}`} className="text-sm font-semibold text-zinc-900 hover:text-blue-700">
                    {talent.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{talent.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/agency/talent-roster/${talent.id}`}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/talent/preview/${talent.id}/dashboard`}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 transition-colors"
                  >
                    Preview Portal
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
