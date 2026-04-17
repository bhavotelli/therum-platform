import { redirect } from "next/navigation";
import { TalentEarningsView } from "@/components/talent/TalentPortalViews";
import { getTalentPortalData } from "@/lib/talent-portal";

type PreviewEarningsPageProps = {
  params: Promise<{ talentId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TalentPreviewEarningsPage({ params }: PreviewEarningsPageProps) {
  const { talentId } = await params;
  const data = await getTalentPortalData(talentId);
  if (!data) redirect("/agency/talent-roster");
  return <TalentEarningsView data={data} />;
}
