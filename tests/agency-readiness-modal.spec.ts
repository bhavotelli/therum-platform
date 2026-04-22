import { expect, test } from '@playwright/test'

test('shows readiness modal before activating deal from edit page', async ({ page }) => {
  // Defensive guard — any native alert() would otherwise block Playwright until
  // the test times out, masking the underlying error (see THE-66).
  page.on('dialog', (dialog) => {
    console.error(`[unexpected dialog] ${dialog.type()}: ${dialog.message()}`)
    void dialog.dismiss()
  })

  await page.goto('/login')
  await page.getByRole('button', { name: 'Agency Admin' }).click()
  await page.waitForURL('**/agency/pipeline')

  const dealTitle = `E2E Readiness ${Date.now()}`

  await page.getByRole('link', { name: '+ New Deal' }).click()
  await page.waitForURL('**/agency/pipeline/new')
  await page.getByLabel('Deal Title').fill(dealTitle)
  await page.locator('input[placeholder="0.00"]').first().fill('1000')
  await page.locator('input[type="date"]').first().fill('2026-05-01')
  await page.getByRole('button', { name: 'Create Deal' }).click()

  await page.waitForURL(/\/agency\/pipeline\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  await page.getByRole('link', { name: 'Edit Deal' }).click()
  await page.waitForURL('**/agency/pipeline/**/edit')

  await page.getByLabel('Pipeline Stage').selectOption('CONTRACTED')
  await page.getByRole('button', { name: 'Save Changes' }).click()
  await page.waitForURL(/\/agency\/pipeline\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

  await page.getByRole('link', { name: 'Edit Deal' }).click()
  await page.waitForURL('**/agency/pipeline/**/edit')
  await page.getByLabel('Pipeline Stage').selectOption('ACTIVE')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByRole('heading', { name: 'Readiness Check: Move to Active' })).toBeVisible()
  await expect(page.getByText('At least one milestone exists.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm Move to Active' })).toBeDisabled()
})
