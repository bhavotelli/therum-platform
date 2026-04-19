import { NextResponse } from 'next/server';
import { xero } from '@/lib/xero';

/**
 * GET /api/xero/connect
 *
 * Generates a Xero OAuth consent URL and redirects the user to it.
 * The `state` parameter is a random hex string used by Xero's OAuth library
 * internally; it is verified automatically during the callback.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const consentUrl = await xero.buildConsentUrl();
    console.log('[XERO] consentUrl:', consentUrl);
    console.log('[XERO] XERO_CLIENT_ID:', process.env.XERO_CLIENT_ID?.slice(0, 8) + '...');
    console.log('[XERO] XERO_REDIRECT_URI:', process.env.XERO_REDIRECT_URI);
    return NextResponse.redirect(consentUrl);
  } catch (err) {
    console.error('[XERO] Failed to build consent URL:', err);
    return NextResponse.json(
      { error: 'Failed to initiate Xero connection. Check XERO_CLIENT_ID and XERO_CLIENT_SECRET.' },
      { status: 500 },
    );
  }
}
