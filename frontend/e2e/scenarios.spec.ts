import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible()
})

test('operator searches payments and opens matching evidence', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Global search' }).fill('Blue Ridge')
  await page.getByRole('searchbox', { name: 'Global search' }).press('Enter')

  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible()
  await expect(page.getByText('Blue Ridge Partners')).toBeVisible()
  await page.getByRole('button', { name: 'View payment pay_8A12' }).click()
  await expect(page.getByRole('dialog', { name: 'Payment details' })).toContainText('Blue Ridge Partners')
})

test('operator filters payments and moves between pages', async ({ page }) => {
  await page.getByRole('link', { name: 'Payments' }).click()
  await page.getByLabel('Rows per page').selectOption('10')

  await expect(page.getByText(/Showing 1–10 of/)).toBeVisible()
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByText(/Showing 11–20 of/)).toBeVisible()
})

test('timeout case is repaired without a duplicate journal', async ({ page }) => {
  await page.getByRole('link', { name: 'Reconciliation' }).click()
  await page.getByRole('button', { name: 'Review case pay_8C42' }).click()
  const evidence = page.getByRole('complementary', { name: 'Reconciliation evidence' })

  await expect(evidence).toContainText('Compare-and-swap guarded')
  await evidence.getByRole('button', { name: 'Approve safe repair' }).click()
  await expect(evidence).toContainText('Repair completed')
  await expect(evidence).toContainText('No new ledger entries created')
})
