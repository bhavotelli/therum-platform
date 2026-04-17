import { redirect } from "next/navigation";
import { TalentProfileView } from "@/components/talent/TalentPortalViews";
import { getTalentPortalData } from "@/lib/talent-portal";

type PreviewProfilePageProps = {
  params: Promise<{ talentId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TalentPreviewProfilePage({ params }: PreviewProfilePageProps) {
  const { talentId } = await params;
  const data = await getTalentPortalData(talentId);
  if (!data) redirect("/agency/talent-roster");
  return <TalentProfileView data={data} homeHref={`/talent/preview/${talentId}/dashboard`} />;
}
