import { redirect } from "next/navigation";
import { resolveAppUser } from "@/lib/auth/resolve-app-user";
import { TalentDealsView } from "@/components/talent/TalentPortalViews";
import { getTalentPortalData, resolveTalentIdForUser } from "@/lib/talent-portal";

export const dynamic = "force-dynamic";

export default async function TalentDealsPage() {
  const appUser = await resolveAppUser();
  const userId = appUser?.id;

  if (!appUser) redirect("/login");

  const talentId = await resolveTalentIdForUser(userId);
  if (!talentId) {
    return (
      <div className="p-20 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-center">
        <p className="text-zinc-500 font-medium">No talent profile linked to this account.</p>
      </div>
    );
  }

  const data = await getTalentPortalData(talentId);
  if (!data) redirect("/login");

  return <TalentDealsView data={data} />;
}
