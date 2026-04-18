import { redirect } from "next/navigation";
import { resolveAppUser } from "@/lib/auth/resolve-app-user";

export default async function Home() {
  const appUser = await resolveAppUser();
  const role = appUser?.role;

  if (role === "SUPER_ADMIN") return redirect("/admin");
  if (role === "AGENCY_ADMIN") return redirect("/agency/pipeline");
  if (role === "AGENT") return redirect("/agency/dashboard");
  if (role === "FINANCE") return redirect("/finance/invoices");
  if (role === "TALENT") return redirect("/talent/dashboard");

  redirect("/login");
}
