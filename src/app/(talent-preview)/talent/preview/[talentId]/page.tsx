import { redirect } from "next/navigation";

type PreviewRootPageProps = {
  params: Promise<{ talentId: string }>;
};

export default async function PreviewRootPage({ params }: PreviewRootPageProps) {
  const { talentId } = await params;
  redirect(`/talent/preview/${talentId}/dashboard`);
}
