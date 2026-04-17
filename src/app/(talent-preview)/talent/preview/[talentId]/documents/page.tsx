import { redirect } from "next/navigation";
import { TalentDocumentsView } from "@/components/talent/TalentPortalViews";
import { getTalentPortalData } from "@/lib/talent-portal";

type PreviewDocumentsPageProps = {
  params: Promise<{ talentId: string }>;
};

export const dynamic = "force-dynamic";

export default async function TalentPreviewDocumentsPage({ params }: PreviewDocumentsPageProps) {
  const { talentId } = await params;
  const data = await getTalentPortalData(talentId);
  if (!data) redirect("/agency/talent-roster");
  return <TalentDocumentsView data={data} />;
}
