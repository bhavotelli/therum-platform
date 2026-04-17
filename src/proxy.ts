import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { getAuthSecret } from "@/lib/auth-secret";

// Map each role to its home URL and the path prefixes it is allowed to visit.
const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  AGENCY_ADMIN: "/agency/pipeline",
  AGENT: "/agency/dashboard",
  FINANCE: "/finance/invoices",
  TALENT: "/talent/dashboard",
};

// Path prefixes that belong exclusively to each portal group.
// A user whose role doesn't own the prefix will be redirected to their home.
const ADMIN_PATHS = ["/admin"];
const AGENCY_PATHS = ["/agency"];
const FINANCE_PATHS = ["/finance"];
const TALENT_PATHS = ["/talent"];

function portalFor(pathname: string): "admin" | "agency" | "finance" | "talent" | null {
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) return "admin";
  if (AGENCY_PATHS.some((p)  => pathname.startsWith(p))) return "agency";
  if (FINANCE_PATHS.some((p) => pathname.startsWith(p))) return "finance";
  if (TALENT_PATHS.some((p)  => pathname.startsWith(p))) return "talent";
  return null;
}

function rolePortal(role: string): "admin" | "agency" | "finance" | "talent" | null {
  if (role === "SUPER_ADMIN") return "admin";
  if (role === "AGENCY_ADMIN" || role === "AGENT") return "agency";
  if (role === "FINANCE")  return "finance";
  if (role === "TALENT")   return "talent";
  return null;
}

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: getAuthSecret() });
  const { pathname } = req.nextUrl;
  const isTalentPreviewRoute = pathname.startsWith("/talent/preview/");
  const talentLoginDisabledForBeta = process.env.THERUM_BETA_PREVIEW_ONLY === "true";

  // Always allow auth routes through
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/xero");

  if (isAuthRoute) {
    // Already logged-in users hitting /login → send to their home portal
    if (token && pathname.startsWith("/login")) {
      const role = token["therum_role"] as string;
      const home = ROLE_HOME[role] ?? "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  // Unauthenticated → login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Role-based portal enforcement
  const role = token["therum_role"] as string;

  if (isTalentPreviewRoute) {
    const canPreviewTalent =
      role === "SUPER_ADMIN" || role === "AGENCY_ADMIN" || role === "AGENT";
    if (!canPreviewTalent) {
      const home = ROLE_HOME[role] ?? "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

  if (talentLoginDisabledForBeta && role === "TALENT") {
    return NextResponse.redirect(
      new URL(
        "/login?notice=Talent+logins+are+disabled+in+beta.+Please+use+agency+preview+mode",
        req.url,
      ),
    );
  }

  const userPortal = rolePortal(role);
  const requestedPortal = portalFor(pathname);

  if (requestedPortal && userPortal && requestedPortal !== userPortal) {
    // User is trying to access a portal that isn't theirs → bounce to home
    const home = ROLE_HOME[role] ?? "/login";
    return NextResponse.redirect(new URL(home, req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply proxy to everything except API routes, static files and images
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
