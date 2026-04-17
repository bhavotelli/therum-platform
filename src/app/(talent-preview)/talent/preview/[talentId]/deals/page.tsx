import { redirect } from "next/navigation";
import { TalentDealsView } from "@/components/talent/TalentPortalViews";
import { getTalentPortalData } from "@/lib/talent-portal";

type PreviewDealsPageProps = {
  params: Promise<{ talentId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TalentPreviewDealsPage({ params }: PreviewDealsPageProps) {
  const { talentId } = await params;
  const data = await getTalentPortalData(talentId);
  if (!data) redirect("/agency/talent-roster");
  return <TalentDealsView data={data} />;
}
