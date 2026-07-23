import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /payment timeout/i })).toBeVisible()
})

test('normal payment completes with a balanced ledger', async ({ page }) => {
  await page.getByRole('button', { name: 'Normal' }).click()

  await expect(page.getByRole('heading', { name: /payment approved/i })).toBeVisible()
  await expect(page.getByText(/risk cleared, double-entry posted/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ledger evidence' })).toBeVisible()
})

test('duplicate payment creates one ledger outcome', async ({ page }) => {
  await page.getByRole('button', { name: 'Duplicate' }).click()

  await expect(page.getByRole('heading', { name: /duplicate safely suppressed/i })).toBeVisible()
  await expect(page.getByText(/one payment, one ledger entry/i)).toBeVisible()
  await expect(page.getByText('Duplicate request replayed')).toBeVisible()
})

test('timeout remains incomplete until reconciliation safely repairs it', async ({ page }) => {
  await expect(page.getByText('Status unknown')).toBeVisible()
  await expect(page.getByText('Reconciliation open')).toBeVisible()
  await page.getByRole('button', { name: /run safe reconciliation/i }).click()

  await expect(page.getByRole('heading', { name: /payment recovered/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /safe repair completed/i })).toBeDisabled()
  await expect(page.getByText(/no duplicate ledger write/i).first()).toBeVisible()
})
