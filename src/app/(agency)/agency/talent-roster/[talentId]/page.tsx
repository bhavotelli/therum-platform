import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

type TalentDetailPageProps = {
  params: Promise<{ talentId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function TalentDetailPage({ params, searchParams }: TalentDetailPageProps) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { talentId } = await params;
  const query = await searchParams;
  const created = query?.created === "1";

  if (!session || !role || !userId) {
    redirect("/login");
  }

  if (!["SUPER_ADMIN", "AGENCY_ADMIN", "AGENT"].includes(role)) {
    redirect("/agency/pipeline");
  }

  const [viewer, talent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { agencyId: true },
    }),
    prisma.talent.findUnique({
      where: { id: talentId },
      select: {
        id: true,
        name: true,
        email: true,
        commissionRate: true,
        vatRegistered: true,
        vatNumber: true,
        portalEnabled: true,
        createdAt: true,
        agencyId: true,
      },
    }),
  ]);

  if (!talent) {
    redirect("/agency/talent-roster");
  }

  if (role !== "SUPER_ADMIN" && viewer?.agencyId !== talent.agencyId) {
    redirect("/agency/talent-roster");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/agency/talent-roster" className="text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-700">
            Back to roster
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900">{talent.name}</h1>
          <p className="text-sm text-zinc-500">{talent.email}</p>
        </div>
        <Link
          href={`/talent/preview/${talent.id}/dashboard`}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
        >
          Preview Portal
        </Link>
      </div>

      {created ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Talent created successfully.</p>
          <p className="mt-1 text-sm text-emerald-800">
            Next step: link this talent to Xero from{" "}
            <Link href="/finance/xero-sync" className="underline font-semibold">
              Finance → Xero Sync
            </Link>{" "}
            to avoid duplicate contact creation.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <p className="text-sm font-semibold text-blue-900">Beta QA Mode</p>
        <p className="mt-1 text-sm text-blue-800">
          Use preview mode to validate this talent&apos;s portal experience during testing. Direct talent login is disabled in beta preview-only mode.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-500">Profile Snapshot</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Commission Rate</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{String(talent.commissionRate)}%</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Portal Access Toggle</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{talent.portalEnabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">VAT Registered</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{talent.vatRegistered ? "Yes" : "No"}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">VAT Number</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">{talent.vatNumber || "Not set"}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">Created {new Date(talent.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}
