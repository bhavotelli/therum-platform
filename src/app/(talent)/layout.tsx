import TalentSidebar from "@/components/layout/TalentSidebar";

export default function TalentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <TalentSidebar />
      <div className="min-w-0 flex flex-col">
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="w-full space-y-6 lg:space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
