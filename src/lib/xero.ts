import { XeroClient } from 'xero-node';

/**
 * Singleton XeroClient instance.
 *
 * Scopes are pulled strictly from the XERO_SCOPES environment variable.
 */
export const xero = new XeroClient({
  clientId:     process.env.XERO_CLIENT_ID     as string,
  clientSecret: process.env.XERO_CLIENT_SECRET as string,
  redirectUris: [process.env.XERO_REDIRECT_URI as string],
  scopes:       (process.env.XERO_SCOPES || '').split(' ').filter(Boolean),
});
