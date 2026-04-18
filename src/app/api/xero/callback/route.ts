import { NextRequest, NextResponse } from 'next/server';
import { resolveAppUser } from '@/lib/auth/resolve-app-user';
import { xero } from '@/lib/xero';
import prisma from '@/lib/prisma';

/**
 * GET /api/xero/callback?code=...&state=...
 *
 * Exchange the authorisation code for an access + refresh token set,
 * identify the currently-authenticated Therum user, find their Agency,
 * and persist the token set as JSON in `Agency.xeroTokens`.
 *
 * After a successful save the browser is redirected to the Finance portal
 * dashboard. On any error it redirects to a dedicated error page.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── 1. Verify the Therum user is logged in ────────────────────────────────
  const appUser = await resolveAppUser();

  if (!appUser) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const userId = appUser.id;

  // ── 2. Exchange the code for tokens ───────────────────────────────────────
  let tokenSet: Record<string, unknown>;

  try {
    // apiCallback() uses the full callback URL (including query string) to:
    //   a) validate the `state` param against the value stored during buildConsentUrl()
    //   b) exchange `code` for the token set via Xero's token endpoint
    const callbackUrl = req.url;
    tokenSet = await xero.apiCallback(callbackUrl) as Record<string, unknown>;
  } catch (err: any) {
    const errorDetails = err?.response?.body || err?.message || err;
    console.error('[XERO CALLBACK] Token exchange failed. Exact error:', JSON.stringify(errorDetails, null, 2));
    
    return NextResponse.redirect(
      new URL('/settings?error=xero_callback_failed', req.url),
    );
  }

  // ── 3. Fetch the Therum user's Agency ─────────────────────────────────────
  let agencyId: string;

  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { agencyId: true },
    });

    if (!user) {
      console.error(`[XERO CALLBACK] User not found in DB: ${userId}`);
      return NextResponse.redirect(
        new URL('/api/xero/error?reason=user_not_found', req.url),
      );
    }

    agencyId = user.agencyId as string;
  } catch (err) {
    console.error('[XERO CALLBACK] DB user lookup failed:', err);
    return NextResponse.redirect(
      new URL('/api/xero/error?reason=db_error', req.url),
    );
  }

  // ── 4. Optionally capture the active tenant ID ────────────────────────────
  //
  //  Calling updateTenants() fetches the list of Xero organisations the user
  //  authorised and sets them on the client instance. We take the first one
  //  as the active tenant and store it alongside the token set so downstream
  //  API calls can supply the correct Xero-Tenant-Id header.
  //
  let xeroTenantId: string | null = null;

  try {
    await xero.updateTenants();
    const tenants = xero.tenants;
    if (tenants && tenants.length > 0) {
      xeroTenantId = tenants[0].tenantId ?? null;
    }
  } catch (err) {
    // Non-fatal: we can still store the token set without the tenant ID.
    // The Finance portal will surface a warning prompting the user to reconnect.
    console.warn('[XERO CALLBACK] updateTenants() failed (non-fatal):', err);
  }

  // ── 5. Persist tokens to the Agency record ────────────────────────────────
  try {
    await prisma.agency.update({
      where: { id: agencyId },
      data: {
        xeroTokens:  JSON.stringify(tokenSet),
        ...(xeroTenantId ? { xeroTenantId } : {}),
      },
    });
  } catch (err) {
    console.error('[XERO CALLBACK] Failed to save token set to Agency:', err);
    return NextResponse.redirect(
      new URL('/api/xero/error?reason=db_save_failed', req.url),
    );
  }

  // ── 6. Redirect to Finance portal on success ──────────────────────────────
  return NextResponse.redirect(new URL('/', req.url));
}
