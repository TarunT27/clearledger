import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('ClearLedger operations console', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.location.hash = '#overview'
  })

  it('navigates every primary operations workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })

    const routes = [
      ['Payments', 'Payments'],
      ['Ledger', 'Ledger explorer'],
      ['Risk', 'Risk monitoring'],
      ['Reconciliation', 'Reconciliation'],
      ['Audit log', 'Audit log'],
    ] as const

    for (const [link, heading] of routes) {
      await user.click(screen.getByRole('link', { name: link }))
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    }
  }, 15_000)

  it('uses global search to open a filtered payments workspace', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.type(screen.getByRole('searchbox', { name: 'Global search' }), 'Summit Office')
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Payments' })
    expect(within(table).getByText('Summit Office LLC')).toBeInTheDocument()
    expect(within(table).queryByText('Blue Ridge Partners')).not.toBeInTheDocument()
  })

  it('opens payment details without mixing evidence from another row', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('link', { name: 'Payments' }))
    const openDetails = await screen.findByRole('button', { name: 'View payment pay_8A12' })
    await user.click(openDetails)

    const details = screen.getByRole('dialog', { name: 'Payment details' })
    expect(within(details).getByRole('button', { name: 'Close' })).toHaveFocus()
    expect(within(details).getByText('pay_8A12')).toBeInTheDocument()
    expect(within(details).getByText('Blue Ridge Partners')).toBeInTheDocument()
    expect(within(details).getByText('$25,000.00')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(openDetails).toHaveFocus()
  })

  it('filters and paginates the payments table', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('link', { name: 'Payments' }))
    await user.selectOptions(await screen.findByLabelText('Payment status'), 'review')

    const table = screen.getByRole('table', { name: 'Payments' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((row) => expect(within(row).getAllByText('Review').length).toBeGreaterThan(0))

    await user.selectOptions(screen.getByLabelText('Payment status'), 'all')
    await user.selectOptions(screen.getByLabelText('Rows per page'), '10')
    expect(screen.getByText(/Showing 1–10 of/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByText(/Showing 11–/)).toBeInTheDocument()
  })

  it('repairs a queued timeout using the existing balanced journal', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('link', { name: 'Reconciliation' }))
    await user.click(await screen.findByRole('button', { name: 'Review case pay_8C42' }))

    const evidence = screen.getByRole('complementary', { name: 'Reconciliation evidence' })
    expect(within(evidence).getByText('Compare-and-swap guarded')).toBeInTheDocument()
    expect(within(evidence).getAllByText(/reuse existing balanced journal/i).length).toBeGreaterThan(0)

    await user.click(within(evidence).getByRole('button', { name: 'Approve safe repair' }))
    expect(await within(evidence).findByText('Repair completed')).toBeInTheDocument()
    expect(within(evidence).getByText('No new ledger entries created')).toBeInTheDocument()
  })

  it('opens functional notification and operator menus', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByRole('dialog', { name: 'Operations notifications' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    expect(screen.getByRole('menu', { name: 'Operator menu' })).toBeInTheDocument()
  })

  it('operates the overview controls and the full console shell', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    expect(screen.getByText('Operations dataset ready')).toBeInTheDocument()
    expect(screen.getByText(/balanced journals verified/i)).toBeInTheDocument()
    expect(screen.queryByText('PostgreSQL connected')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '7 days' }))
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    await user.click(screen.getByRole('button', { name: 'Collapse navigation' }))
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand navigation' }))

    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    const notifications = screen.getByRole('dialog', { name: 'Operations notifications' })
    await user.click(within(notifications).getByRole('button', { name: /Mark Reconciliation case ready as read/ }))
    await user.click(within(notifications).getByRole('button', { name: 'Mark all as read' }))
    await user.click(within(notifications).getByRole('button', { name: 'Close notifications' }))

    await user.click(screen.getByRole('button', { name: 'Open account menu' }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: /Preferences/ }))
    await user.click(screen.getByRole('menuitem', { name: /Help & support/ }))
    expect(screen.getByText('Operator help')).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'View payment pay_8C42' }))
    expect(await screen.findByRole('dialog', { name: 'Payment details' })).toBeInTheDocument()
  })

  it('creates, inspects, sorts, copies, and exports a payment', async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('link', { name: 'Payments' }))

    const paymentSearch = await screen.findByRole('searchbox', { name: 'Search payments' })
    await user.type(paymentSearch, 'Summit')
    await user.click(screen.getByRole('button', { name: 'Clear payment search' }))
    await user.click(screen.getByRole('button', { name: 'Updated' }))
    await user.selectOptions(screen.getByLabelText('Risk decision'), 'review')
    await user.selectOptions(screen.getByLabelText('Risk decision'), 'all')

    await user.click(screen.getByRole('button', { name: 'New payment' }))
    const composer = screen.getByRole('dialog', { name: 'New payment' })
    await user.click(within(composer).getByRole('button', { name: 'Create payment' }))
    expect(within(composer).getByRole('alert')).toHaveTextContent('Enter an amount')
    await user.type(within(composer).getByLabelText('Amount'), '8750')
    await user.type(within(composer).getByLabelText('Recipient'), 'Keystone Treasury Services')
    await user.click(within(composer).getByRole('button', { name: 'Create payment' }))

    const details = await screen.findByRole('dialog', { name: 'Payment details' })
    expect(within(details).getByText('pay_9F16')).toBeInTheDocument()
    await user.click(within(details).getByRole('button', { name: 'Copy ID' }))
    expect(await screen.findByText('Copied payment ID pay_9F16.')).toBeInTheDocument()
    await user.click(within(details).getByRole('button', { name: 'Open full record' }))
    expect(within(details).getByRole('heading', { name: 'Full record' })).toBeInTheDocument()
    await user.click(within(details).getByRole('button', { name: 'Hide full record' }))
    await user.click(within(details).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(anchorClick).toHaveBeenCalledOnce()
  })

  it('runs every isolated safety scenario from the scenario lab', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('link', { name: 'Scenario lab' }))
    await screen.findByRole('heading', { name: 'Scenario lab' })
    await user.click(await screen.findByRole('button', { name: 'Duplicate' }))
    expect(await screen.findByText(/Duplicate replayed safely/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Timeout' }))
    expect((await screen.findAllByText('Reconciliation open')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Run safe reconciliation' }))
    expect((await screen.findAllByText(/Safe repair completed/)).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Normal' }))
    expect(await screen.findByText(/Normal payment completed/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Amount'))
    await user.type(screen.getByLabelText('Amount'), '430')
    await user.type(screen.getByLabelText('Recipient'), 'Scenario Recipient')
    await user.click(screen.getByRole('button', { name: 'Send payment' }))
    expect(await screen.findByText('Payment approved and ledger balanced.')).toBeInTheDocument()
  })

  it('filters and drills through ledger, risk, and audit evidence', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: 'Operations overview' })
    await user.click(screen.getByRole('link', { name: 'Ledger' }))
    const journalSearch = await screen.findByRole('searchbox', { name: 'Search journals' })
    await user.type(journalSearch, 'no-such-journal')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await user.click(screen.getAllByRole('button', { name: /View journal/ })[1])

    await user.click(screen.getByRole('link', { name: 'Risk' }))
    await user.selectOptions(await screen.findByLabelText('Risk status'), 'Rejected')
    const riskAction = screen.getAllByRole('button', { name: /Open risk evidence/ })[0]
    await user.click(riskAction)
    expect(await screen.findByRole('dialog', { name: 'Payment details' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Audit log' }))

    const auditSearch = await screen.findByRole('searchbox', { name: 'Search audit events' })
    await user.type(auditSearch, 'no-such-event')
    await user.click(screen.getAllByRole('button', { name: 'Reset filters' })[0])
    await user.selectOptions(screen.getByLabelText('Audit actor'), 'payment-api')
    await user.selectOptions(screen.getByLabelText('Audit event type'), 'Payment received')
    await user.click(screen.getAllByRole('button', { name: 'Reset filters' })[0])
  }, 15_000)
})
