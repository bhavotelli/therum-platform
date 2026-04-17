import FinanceSidebar from "@/components/layout/FinanceSidebar";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex">
      <FinanceSidebar />
      <div className="flex-1 lg:pl-64 flex flex-col">
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
