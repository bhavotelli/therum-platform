import { expect, test } from '@playwright/test';

const portals = [
  { name: 'super admin', quickAccessLabel: 'Super Admin', expectedPathAfterLogin: '/admin' },
  { name: 'agency', quickAccessLabel: 'Agency Admin', expectedPathAfterLogin: '/agency/pipeline' },
  { name: 'finance', quickAccessLabel: 'Finance', expectedPathAfterLogin: '/finance/invoices' },
  { name: 'talent', quickAccessLabel: 'Talent', expectedPathAfterLogin: '/talent/dashboard' },
] as const;

for (const portal of portals) {
  test(`shows sign-out toast and redirects on ${portal.name} portal`, async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: portal.quickAccessLabel }).click();
    await page.waitForURL(`**${portal.expectedPathAfterLogin}`);

    await page.getByRole('button', { name: 'Sign Out' }).click();

    await expect(page.getByText('Signed out successfully. Redirecting to login...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Signing Out...' })).toBeDisabled();
    await page.waitForURL('**/login');
    await expect(page.getByRole('button', { name: 'Enter System' })).toBeVisible();
  });
}
