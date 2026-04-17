import { redirect } from "next/navigation";
import { TalentDashboardView } from "@/components/talent/TalentPortalViews";
import { getTalentPortalData } from "@/lib/talent-portal";

type PreviewDashboardPageProps = {
  params: Promise<{ talentId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TalentPreviewDashboardPage({ params }: PreviewDashboardPageProps) {
  const { talentId } = await params;
  const data = await getTalentPortalData(talentId);
  if (!data) redirect("/agency/talent-roster");
  return <TalentDashboardView data={data} />;
}
