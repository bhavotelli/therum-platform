"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/layout/Logo";

const DEV_ACCOUNTS = [
  { label: "Super Admin",  email: "bhavik@therum.co",       role: "SUPER_ADMIN",  color: "red"    },
  { label: "Agency Admin", email: "admin@testagency.com",   role: "AGENCY_ADMIN", color: "indigo" },
  { label: "Agency Agent", email: "agent@testagency.com",   role: "AGENT",        color: "violet" },
  { label: "Finance",      email: "finance@testagency.com", role: "FINANCE",      color: "teal"   },
  { label: "Talent",       email: "talent@testagency.com",  role: "TALENT",       color: "purple" },
] as const;

const talentLoginDisabledForBeta = process.env.NEXT_PUBLIC_THERUM_BETA_PREVIEW_ONLY === "true";

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN:  "/admin",
  AGENCY_ADMIN: "/agency/pipeline",
  AGENT:        "/agency/dashboard",
  FINANCE:      "/finance/invoices",
  TALENT:       "/talent/dashboard",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams.get('notice') ?? '';
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doSignIn(emailVal: string, passwordVal: string) {
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: emailVal,
        password: passwordVal || "password",
      });

      if (result?.error) {
        setError(
          result.error === "CredentialsSignin"
            ? "Invalid email or password"
            : result.error
        );
        setLoading(false);
      } else {
        // Re-fetch the session to get the role, then redirect accordingly
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        const role = session?.user?.role as string | undefined;
        const home = role ? (ROLE_HOME[role] ?? "/talent/dashboard") : "/talent/dashboard";
        router.push(home);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doSignIn(email, password);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0F1623] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans transition-colors duration-500">
      
      {/* Immersive Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,85,204,0.15),transparent_70%)]"></div>
        <div className="absolute inset-0 opacity-[0.03] text-black dark:text-[#C5D0E8]" style={{ backgroundImage: 'radial-gradient(currentColor 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6">
            <Logo className="text-5xl text-zinc-900 dark:text-white drop-shadow-sm" />
          </div>
          <p className="mt-3 text-center text-xs font-bold text-indigo-900/60 dark:text-indigo-200/40 uppercase tracking-[0.4em]">
            Financial Operating System
          </p>
        </div>

        <div className="space-y-6">
          {/* Main Login Card */}
          <div className="bg-white dark:bg-white/[0.04] rounded-[2rem] shadow-2xl p-8 sm:p-10 border border-black/5 dark:border-white/20 relative group overflow-hidden transition-colors duration-500">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              {notice && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 px-4 py-3 rounded-lg text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                  {notice}
                </div>
              )}
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">
                  Email Platform ID
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10 rounded-2xl text-black dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-white/10 transition-all outline-none border shadow-inner"
                  placeholder="name@agency.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">
                  Secure Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-white/10 rounded-2xl text-black dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-white/10 transition-all outline-none border shadow-inner"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-blue-600 dark:bg-[#0F1623] hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : "Enter System"}
              </button>
            </form>
          </div>

          {/* Dev Quick Login — only visible in development */}
          {process.env.NODE_ENV !== "production" && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 px-4">
                <div className="h-px flex-1 bg-white/10"></div>
                <span className="text-[10px] font-black text-black/30 dark:text-white/30 uppercase tracking-[0.3em]">Quick Access</span>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {DEV_ACCOUNTS
                  .filter((acc) => !(talentLoginDisabledForBeta && acc.role === "TALENT"))
                  .map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={loading}
                    onClick={() => doSignIn(acc.email, "password")}
                    className="flex flex-col items-start p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                       <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(30,85,204,0.5)] ${
                         acc.role.startsWith('AGENCY') ? 'bg-blue-400' :
                         acc.role === 'FINANCE' ? 'bg-teal-400' : 'bg-purple-400'
                       }`}></span>
                       <span className="text-[8px] font-black text-black/40 dark:text-white/20 uppercase tracking-tighter group-hover:text-black/60 dark:group-hover:text-white/40">
                         {acc.role.split('_')[0]}
                       </span>
                    </div>
                    <div className="text-[11px] font-black text-black dark:text-white uppercase tracking-tight">{acc.label}</div>
                    <div className="text-[9px] text-black/50 dark:text-white/40 font-mono mt-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      {acc.email.split('@')[0]}
                    </div>
                  </button>
                ))}
              </div>
              {talentLoginDisabledForBeta && (
                <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600/80">
                  Talent login disabled in beta preview-only mode
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-[#0F1623] flex items-center justify-center"><div className="animate-spin h-8 w-8 text-indigo-600 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>}>
      <LoginForm />
    </Suspense>
  );
}
