"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Dev-only quick-login buttons. Kept in sync with `scripts/seed.ts`, which
// provisions exactly these accounts. Grouped by agency so devs can flip
// between the two seeded tenants (Test Agency = SELF_BILLING, Tidal Studios
// = ON_BEHALF) without round-tripping through super-admin impersonation.
type DevAccount = { label: string; email: string; role: string }
type DevAgencyGroup = { heading: string; accounts: readonly DevAccount[] }

const DEV_SUPER_ADMIN: DevAccount = {
  label: "Super Admin", email: "bhavik@therum.io", role: "SUPER_ADMIN",
}

const DEV_AGENCY_GROUPS: readonly DevAgencyGroup[] = [
  {
    heading: "Test Agency (SELF_BILLING)",
    accounts: [
      { label: "Agent",   email: "agent@testagency.com",   role: "AGENT"   },
      { label: "Finance", email: "finance@testagency.com", role: "FINANCE" },
      { label: "Talent",  email: "talent@testagency.com",  role: "TALENT"  },
    ],
  },
  {
    heading: "Tidal Studios (ON_BEHALF)",
    accounts: [
      { label: "Agent",   email: "agent@tidalstudios.com",   role: "AGENT"   },
      { label: "Finance", email: "finance@tidalstudios.com", role: "FINANCE" },
    ],
  },
] as const

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN:  "/admin",
  AGENCY_ADMIN: "/agency/pipeline",
  AGENT:        "/agency/dashboard",
  FINANCE:      "/finance/invoices",
  TALENT:       "/talent/dashboard",
};

function DevQuickLoginButton({
  account,
  disabled,
  onClick,
}: {
  account: DevAccount
  disabled: boolean
  onClick: () => void
}) {
  const dotColor =
    account.role === 'SUPER_ADMIN' ? 'bg-red-400' :
    account.role === 'FINANCE' ? 'bg-teal-400' :
    account.role === 'AGENT' ? 'bg-violet-400' :
    'bg-purple-400'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-start p-4 rounded-2xl bg-black/5 border border-black/10 hover:bg-black/10 hover:border-black/20 transition-all text-left group disabled:opacity-50 w-full"
    >
      <div className="flex items-center justify-between w-full mb-1">
        <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(30,85,204,0.5)] ${dotColor}`}></span>
        <span className="text-[8px] font-black text-black/40 uppercase tracking-tighter group-hover:text-black/60">
          {account.role.split('_')[0]}
        </span>
      </div>
      <div className="text-[11px] font-black text-black uppercase tracking-tight">{account.label}</div>
      <div className="text-[9px] text-black/50 font-mono mt-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
        {account.email.split('@')[0]}
      </div>
    </button>
  )
}

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
      const supabase = createSupabaseBrowserClient();
      const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
        email: emailVal.trim(),
        password: passwordVal || "password",
      });

      if (signErr) {
        setError(
          signErr.message.toLowerCase().includes("invalid")
            ? "Invalid email or password"
            : signErr.message
        );
        setLoading(false);
        return;
      }

      const access_token = signData.session?.access_token;
      const refresh_token = signData.session?.refresh_token;
      if (!access_token || !refresh_token) {
        setLoading(false);
        setError("Could not establish a session. Please try again.");
        return;
      }

      const est = await fetch("/api/auth/establish-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token,
          refresh_token,
        }),
      });

      if (!est.ok) {
        await supabase.auth.signOut();
        let apiMessage = "";
        try {
          const errBody = (await est.json()) as { message?: string; error?: string };
          if (typeof errBody?.message === "string" && errBody.message.length > 0) {
            apiMessage = errBody.message;
          }
        } catch {
          /* ignore */
        }
        if (apiMessage) {
          setError(apiMessage);
        } else if (est.status === 403) {
          setError("Your account is not linked in Therum yet.");
        } else if (est.status === 401) {
          setError(
            "Your session could not be verified on the server. Confirm NEXT_PUBLIC_SUPABASE_* match this project and redeploy after changing them."
          );
        } else if (est.status === 503) {
          setError(
            "Cannot reach the app database. Check DATABASE_URL on Vercel matches the same Supabase project as Auth."
          );
        } else if (est.status === 500) {
          setError(
            "Server configuration error (often missing AUTH_SECRET / NEXTAUTH_SECRET). Check Vercel env."
          );
        } else {
          setError("Could not complete sign-in. Please try again.");
        }
        setLoading(false);
        return;
      }

      const me = await fetch("/api/auth/me", { credentials: "include" });
      const payload = me.ok ? await me.json() : null;
      const role = payload?.user?.role as string | undefined;
      const home = role ? (ROLE_HOME[role] ?? "/talent/dashboard") : "/talent/dashboard";
      router.push(home);
      router.refresh();
      setLoading(false);
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
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,85,204,0.15),transparent_70%)]"></div>
        <div className="absolute inset-0 opacity-[0.03] text-black" style={{ backgroundImage: 'radial-gradient(currentColor 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-6">
            <Logo className="text-5xl text-zinc-900 drop-shadow-sm" />
          </div>
          <p className="mt-3 text-center text-xs font-bold text-indigo-900/60 uppercase tracking-[0.4em]">
            Financial Operating System
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 sm:p-10 border border-black/5 relative group overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="mb-8 text-center space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sign in</h1>
              <p className="text-sm text-zinc-500">Use your Therum account. You will be routed to the portal for your role.</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit} autoComplete="on">
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

              {/*
                suppressHydrationWarning: password managers (LastPass, 1Password,
                Dashlane) inject a sibling <div data-*-icon-root> next to each
                input before React hydrates, causing a hydration mismatch on the
                wrapper. We can't prevent the injection, so suppress the warning
                on the wrapper only — app-level mismatches elsewhere still surface.
                Ref: THE-41.
              */}
              <div className="space-y-2" suppressHydrationWarning>
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">
                  Email Platform ID
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-black text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none shadow-inner"
                  placeholder="name@agency.com"
                />
              </div>

              <div className="space-y-2" suppressHydrationWarning>
                <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-[#64748B] ml-1">
                  Secure Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-black text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none shadow-inner"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-900/10 disabled:opacity-50"
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
            <div className="space-y-4">
              <div className="flex items-center gap-4 px-4">
                <div className="h-px flex-1 bg-black/10"></div>
                <span className="text-[10px] font-black text-black/30 uppercase tracking-[0.3em]">Quick Access</span>
                <div className="h-px flex-1 bg-black/10"></div>
              </div>

              {/* Super Admin — standalone, spans full width because impersonation is cross-agency */}
              <DevQuickLoginButton
                account={DEV_SUPER_ADMIN}
                disabled={loading}
                onClick={() => doSignIn(DEV_SUPER_ADMIN.email, "password")}
              />

              {/* Per-agency groups — Agent + Finance per tenant */}
              {DEV_AGENCY_GROUPS.map((group) => (
                <div key={group.heading} className="space-y-2">
                  <p className="text-[9px] font-black text-black/40 uppercase tracking-[0.25em] px-1">
                    {group.heading}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {group.accounts.map((acc) => (
                      <DevQuickLoginButton
                        key={acc.email}
                        account={acc}
                        disabled={loading}
                        onClick={() => doSignIn(acc.email, "password")}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 flex items-center justify-center"><div className="animate-spin h-8 w-8 text-indigo-600 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>}>
      <LoginForm />
    </Suspense>
  );
}
