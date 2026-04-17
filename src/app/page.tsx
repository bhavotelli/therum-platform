import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (role === "SUPER_ADMIN")  return redirect("/admin");
  if (role === "AGENCY_ADMIN") return redirect("/agency/pipeline");
  if (role === "AGENT")        return redirect("/agency/dashboard");
  if (role === "FINANCE")      return redirect("/finance/invoices");
  if (role === "TALENT")       return redirect("/talent/dashboard");

  // Unauthenticated users will be caught by middleware/login redirect
  redirect("/login");
}
