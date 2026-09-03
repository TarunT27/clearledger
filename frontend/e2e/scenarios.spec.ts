import { expect, test, type Page } from '@playwright/test'

/**
 * Browser coverage of the operator's real path through a live stack.
 *
 * Nothing here is mocked: the console talks to the API, which talks to PostgreSQL. The
 * safety story is exercised end to end — the scenario lab creates a genuine unfinished
 * payment, and the workbench repairs it under the same compare-and-swap guard the
 * background worker uses.
 */

async function goTo(page: Page, view: string) {
  await page.getByRole('button', { name: view, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Operations overview' })).toBeVisible()
})

test('overview reports figures the API computed from the ledger', async ({ page }) => {
  await expect(page.getByText('Processed volume')).toBeVisible()
  await expect(page.getByText('Approval rate')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ledger health' })).toBeVisible()

  // The console cannot render an overview at all unless the API answered. The label is
  // on the element rather than only in its text, so this holds on a phone too.
  await expect(page.getByLabel('API connected')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Payment activity' })).toBeVisible()
})

test('operator searches payments and opens the evidence behind one', async ({ page }) => {
  await page.getByRole('searchbox').first().fill('Northstar')
  await page.getByRole('searchbox').first().press('Enter')

  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible()
  const firstReference = page.locator('tbody tr .mono').first()
  await expect(firstReference).toContainText('PAY-')
  await firstReference.click()

  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('Risk evidence')).toBeVisible()
  await expect(drawer.getByText('Audit trail')).toBeVisible()
  await expect(drawer.getByText(/Optimistic-lock version/)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('payment filters and paging are answered by the server', async ({ page }) => {
  await goTo(page, 'Payments')

  await page.getByLabel('Filter by status').selectOption('APPROVED')
  await expect(page.locator('tbody tr').first()).toContainText('Approved')

  const footer = page.getByText(/Page \d+ of \d+/)
  await expect(footer).toBeVisible()
  const next = page.getByRole('button', { name: 'Next' })
  if (await next.isEnabled()) {
    await next.click()
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled()
  }
})

test('every listed journal balances', async ({ page }) => {
  await goTo(page, 'Ledger')

  await expect(page.getByRole('heading', { name: 'Ledger', exact: true })).toBeVisible()
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  await expect(page.getByText('Unbalanced')).toHaveCount(0)
})

test('risk page publishes the thresholds the engine is running with', async ({ page }) => {
  await goTo(page, 'Risk')

  await expect(page.getByRole('heading', { name: 'Policy in force' })).toBeVisible()
  await expect(page.getByText('at or above $10,000.00')).toBeVisible()
  await expect(page.getByText('score 40 or higher')).toBeVisible()
})

async function journalCount(page: Page): Promise<number> {
  await goTo(page, 'Ledger')
  const footer = await page.getByText(/[\d,]+ journals?/).first().innerText()
  return Number(footer.replace(/[^\d]/g, ''))
}

test('a timeout is created, then repaired without a second journal', async ({ page }) => {
  await goTo(page, 'Scenario lab')
  await page
    .locator('section', { hasText: 'Timeout after commit' })
    .getByRole('button', { name: 'Run' })
    .click()
  await expect(page.getByText('journal committed')).toBeVisible()

  // The scenario committed a journal and left the payment unfinished. Count the ledger
  // now: a correct repair must not change this number.
  const journalsBeforeRepair = await journalCount(page)
  expect(journalsBeforeRepair).toBeGreaterThan(0)

  await goTo(page, 'Reconciliation')
  const openCase = page.locator('article').filter({ hasText: 'Balanced' }).first()
  await expect(openCase).toBeVisible()
  await expect(openCase.getByText(/expects version \d+/)).toBeVisible()
  await expect(openCase.getByText('Finalize approved')).toBeVisible()

  await openCase.getByRole('button', { name: 'Repair safely' }).click()

  // The toast reports the compare-and-swap that finished the payment.
  await expect(page.getByRole('status').getByText(/version \d+ → \d+/)).toBeVisible()

  expect(await journalCount(page)).toBe(journalsBeforeRepair)
  await expect(page.getByText('Unbalanced')).toHaveCount(0)
})

test('audit log is read-only and records what the engine did', async ({ page }) => {
  await goTo(page, 'Audit log')

  await expect(page.getByText('Read-only by design')).toBeVisible()
  await page.getByLabel('Filter by event type').selectOption('JOURNAL_POSTED')
  await expect(page.locator('tbody tr').first()).toContainText('Journal posted')
})

test('appearance follows an explicit choice and survives a reload', async ({ page }) => {
  const root = page.locator('html')
  await expect(root).not.toHaveAttribute('data-theme', 'dark')

  // system → light → dark
  await page.getByRole('button', { name: /^Appearance/ }).click()
  await page.getByRole('button', { name: /^Appearance/ }).click()
  await expect(root).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(root).toHaveAttribute('data-theme', 'dark')
})
