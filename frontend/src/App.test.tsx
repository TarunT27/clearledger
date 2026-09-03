import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import {
  mockFetch,
  overview,
  page,
  paymentDetail,
  paymentRow,
  reconciliationBoard,
  repairOutcome,
  recipientParty,
  riskReport,
  senderParty,
  journal,
  auditEvent,
} from './test/fixtures'

// Order matters: the router matches by substring, so the repair path must be listed
// before the reconciliation board it is nested under.
const ROUTES = {
  '/repair': repairOutcome,
  '/console/overview': overview,
  '/console/payments/': paymentDetail,
  '/console/payments': page([paymentRow()]),
  '/console/journals': page([journal]),
  '/console/audit-events': page([auditEvent]),
  '/console/risk': riskReport,
  '/console/reconciliation': reconciliationBoard,
  '/console/counterparties?role=SENDER': [senderParty],
  '/console/counterparties?role=RECIPIENT': [recipientParty],
}

describe('operations console', () => {
  beforeEach(() => {
    window.location.hash = ''
    vi.stubGlobal('fetch', mockFetch(ROUTES))
  })

  it('opens on the overview with figures taken from the API', async () => {
    render(<App />)

    expect(await screen.findByText('Operations overview')).toBeInTheDocument()
    expect(await screen.findByText('$222.3K')).toBeInTheDocument()
    expect(screen.getByText('72 payments')).toBeInTheDocument()
    expect(screen.getByText('Ledger health')).toBeInTheDocument()
  })

  it('shows the API as connected once the status poll succeeds', async () => {
    render(<App />)
    expect(await screen.findByLabelText('API connected')).toBeInTheDocument()
  })

  it('reports an unreachable API instead of rendering an empty dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    render(<App />)

    expect(await screen.findByLabelText('API unreachable')).toBeInTheDocument()
    expect(
      await screen.findByText(/Cannot reach the ClearLedger API/),
    ).toBeInTheDocument()
  })

  it('badges the sidebar with the number of open reconciliation cases', async () => {
    render(<App />)
    const reconciliation = await screen.findByRole('button', { name: /Reconciliation/ })
    expect(within(reconciliation).getByText('1')).toBeInTheDocument()
  })

  it('navigates to payments and lists records from the server', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Payments/ }))

    expect(await screen.findByRole('heading', { name: 'Payments', level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('PAY-E1F20001')).toBeInTheDocument()
    expect(screen.getByText('Northstar Supplies')).toBeInTheDocument()
  })

  it('opens the evidence drawer with risk, ledger, and audit sections', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Payments/ }))
    await user.click(await screen.findByText('PAY-E1F20001'))

    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Risk evidence')).toBeInTheDocument()
    expect(within(drawer).getByText('Ledger journal')).toBeInTheDocument()
    expect(within(drawer).getByText('Audit trail')).toBeInTheDocument()
    expect(within(drawer).getByText('New recipient')).toBeInTheDocument()
    expect(within(drawer).getByText('Balanced')).toBeInTheDocument()
  })

  it('closes the drawer on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Payments/ }))
    await user.click(await screen.findByText('PAY-E1F20001'))
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sends the toolbar search to the payments view as a server-side filter', async () => {
    const fetchMock = mockFetch(ROUTES)
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.type(await screen.findByRole('searchbox'), 'northstar{Enter}')

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes('/console/payments?query=northstar'),
        ),
      ).toBe(true),
    )
  })

  it('surfaces the compare-and-swap versions after a repair', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Reconciliation/ }))
    await user.click(await screen.findByRole('button', { name: /Repair safely/ }))

    expect(
      await screen.findByText(/PAY-E1F20002 repaired — version 1 → 2, now approved\./),
    ).toBeInTheDocument()
  })

  it('explains why the reconciliation worker is paused rather than hiding it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Reconciliation/ }))

    expect(await screen.findByText('Worker paused')).toBeInTheDocument()
  })

  it('reports the live risk thresholds the engine is running with', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Risk/ }))

    expect(await screen.findByText('Policy in force')).toBeInTheDocument()
    expect(screen.getByText('at or above $10,000.00')).toBeInTheDocument()
    expect(screen.getByText('score 40 or higher')).toBeInTheDocument()
  })

  it('lists journals with the totals that prove they balance', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /^Ledger/ }))

    expect(await screen.findByText('JRN-AAAA0001')).toBeInTheDocument()
    expect(screen.getAllByText('$250.00')).toHaveLength(2)
  })

  it('shows the append-only audit trail', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /Audit log/ }))

    expect(await screen.findByText('Read-only by design')).toBeInTheDocument()
    expect(screen.getByText('Journal posted')).toBeInTheDocument()
  })
})
