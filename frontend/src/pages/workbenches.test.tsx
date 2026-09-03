import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditPage } from './AuditPage'
import { LedgerPage } from './LedgerPage'
import { OverviewPage } from './OverviewPage'
import { ReconciliationPage } from './ReconciliationPage'
import { RiskPage } from './RiskPage'
import {
  auditEvent,
  journal,
  mockFetch,
  overview,
  page,
  reconciliationBoard,
  repairOutcome,
  riskReport,
} from '../test/fixtures'

/** Captures whatever a CSV export hands to Blob, which jsdom cannot read back. */
function captureDownloads(): string[] {
  const written: string[] = []
  vi.stubGlobal(
    'Blob',
    class {
      constructor(parts: readonly unknown[]) {
        written.push(String(parts[0]))
      }
    },
  )
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:clearledger/test'),
    revokeObjectURL: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return written
}

describe('ledger workbench', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/console/journals': page([journal]) }))
  })

  it('exports journals with both totals so balance can be checked offline', async () => {
    const written = captureDownloads()
    const user = userEvent.setup()
    render(<LedgerPage onSelectPayment={vi.fn()} reloadToken={0} />)
    await screen.findByText('JRN-AAAA0001')

    await user.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(written[0]).toContain('Debits,Credits')
    expect(written[0]).toContain('250.00,250.00')
  })

  it('debounces the search into a single server query', async () => {
    const fetchMock = mockFetch({ '/console/journals': page([journal]) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<LedgerPage onSelectPayment={vi.fn()} reloadToken={0} />)
    await screen.findByText('JRN-AAAA0001')
    const before = fetchMock.mock.calls.length

    await user.type(screen.getByLabelText('Search journals'), 'northstar')

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes('query=northstar')),
      ).toBe(true),
    )
    expect(fetchMock.mock.calls.length - before).toBeLessThan(9)
  })

  it('opens the payment behind a journal', async () => {
    const onSelectPayment = vi.fn()
    const user = userEvent.setup()
    render(<LedgerPage onSelectPayment={onSelectPayment} reloadToken={0} />)

    await user.click(await screen.findByText('JRN-AAAA0001'))

    expect(onSelectPayment).toHaveBeenCalledWith(journal.paymentId)
  })
})

describe('audit log', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/console/audit-events': page([auditEvent]) }))
  })

  it('filters by event type on the server', async () => {
    const fetchMock = mockFetch({ '/console/audit-events': page([auditEvent]) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AuditPage onSelectPayment={vi.fn()} reloadToken={0} />)
    await screen.findByText('Journal posted')

    await user.selectOptions(screen.getByLabelText('Filter by event type'), 'JOURNAL_POSTED')

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes('eventType=JOURNAL_POSTED'),
        ),
      ).toBe(true),
    )
  })

  it('exports the trail with actor and detail intact', async () => {
    const written = captureDownloads()
    const user = userEvent.setup()
    render(<AuditPage onSelectPayment={vi.fn()} reloadToken={0} />)
    await screen.findByText('Journal posted')

    await user.click(screen.getByRole('button', { name: 'Export CSV' }))

    expect(written[0]).toContain('LEDGER')
    expect(written[0]).toContain('Balanced debit and credit entries committed.')
  })
})

describe('overview', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/console/overview': overview }))
  })

  it('requests a new window when the range changes', async () => {
    const fetchMock = mockFetch({ '/console/overview': overview })
    vi.stubGlobal('fetch', fetchMock)
    const onRangeChange = vi.fn()
    const user = userEvent.setup()
    render(
      <OverviewPage
        range="7d"
        onRangeChange={onRangeChange}
        onNavigate={vi.fn()}
        onSelectPayment={vi.fn()}
      />,
    )
    await screen.findByText('Operations overview')

    await user.click(screen.getByRole('button', { name: '30 days' }))

    expect(onRangeChange).toHaveBeenCalledWith('30d')
  })

  it('colours a rise in manual review as a regression, not an improvement', async () => {
    render(
      <OverviewPage
        range="7d"
        onRangeChange={vi.fn()}
        onNavigate={vi.fn()}
        onSelectPayment={vi.fn()}
      />,
    )
    await screen.findByText('Manual review')

    const review = screen.getByText('Manual review').closest('.metric')
    expect(review?.querySelector('.delta--down')).not.toBeNull()

    const volume = screen.getByText('Processed volume').closest('.metric')
    expect(volume?.querySelector('.delta--up')).not.toBeNull()
  })

  it('omits a comparison when the prior window held no data', async () => {
    render(
      <OverviewPage
        range="7d"
        onRangeChange={vi.fn()}
        onNavigate={vi.fn()}
        onSelectPayment={vi.fn()}
      />,
    )
    await screen.findByText('Open exceptions')

    const exceptions = screen.getByText('Open exceptions').closest('.metric')
    expect(exceptions?.querySelector('.delta')).toBeNull()
  })

  it('links each panel to the workbench that owns it', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(
      <OverviewPage
        range="7d"
        onRangeChange={vi.fn()}
        onNavigate={onNavigate}
        onSelectPayment={vi.fn()}
      />,
    )
    await screen.findByText('Operations overview')

    await user.click(screen.getByRole('button', { name: /Open risk/ }))
    await user.click(screen.getByRole('button', { name: /Open workbench/ }))
    await user.click(screen.getByRole('button', { name: /Open ledger/ }))

    expect(onNavigate.mock.calls.map(([view]) => view)).toEqual([
      'risk',
      'reconciliation',
      'ledger',
    ])
  })

  it('opens a queued exception from the recovery list', async () => {
    const onSelectPayment = vi.fn()
    const user = userEvent.setup()
    render(
      <OverviewPage
        range="7d"
        onRangeChange={vi.fn()}
        onNavigate={vi.fn()}
        onSelectPayment={onSelectPayment}
      />,
    )

    await user.click(await screen.findByText('PAY-E1F20002'))

    expect(onSelectPayment).toHaveBeenCalledWith(overview.exceptions[0].id)
  })
})

describe('risk workbench', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/console/risk': riskReport }))
  })

  it('says the queue is clear rather than showing an empty table', async () => {
    render(
      <RiskPage range="7d" onRangeChange={vi.fn()} onSelectPayment={vi.fn()} reloadToken={0} />,
    )

    expect(await screen.findByText('Rejected')).toBeInTheDocument()
    expect(
      screen.getByText('No payment has been rejected in this book.'),
    ).toBeInTheDocument()
  })

  it('opens a queued payment for review', async () => {
    const onSelectPayment = vi.fn()
    const user = userEvent.setup()
    render(
      <RiskPage
        range="7d"
        onRangeChange={vi.fn()}
        onSelectPayment={onSelectPayment}
        reloadToken={0}
      />,
    )

    await user.click(await screen.findByText('PAY-E1F20001'))

    expect(onSelectPayment).toHaveBeenCalled()
  })
})

describe('reconciliation workbench', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ '/repair': repairOutcome, '/console/reconciliation': reconciliationBoard }),
    )
  })

  it('runs a full sweep through the operational endpoint', async () => {
    const fetchMock = mockFetch({
      '/reconciliation/runs': { scanned: 1, repaired: 1, flagged: 0 },
      '/console/reconciliation': reconciliationBoard,
    })
    vi.stubGlobal('fetch', fetchMock)
    const onToast = vi.fn()
    const user = userEvent.setup()
    render(
      <ReconciliationPage
        onSelectPayment={vi.fn()}
        onNavigate={vi.fn()}
        onToast={onToast}
        onChanged={vi.fn()}
        reloadToken={0}
      />,
    )
    await screen.findByText('Cases')

    await user.click(screen.getByRole('button', { name: /Run sweep/ }))

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith('Reconciliation sweep completed.', 'success'),
    )
    const sweep = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes('/reconciliation/runs'),
    )
    expect((sweep?.[1] as RequestInit).headers).toMatchObject({
      'X-ClearLedger-Request': 'ClearLedgerConsole',
    })
  })

  it('reports a lost race as already resolved instead of a failure', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/repair': {
          ...repairOutcome,
          alreadyResolved: true,
          action: 'NO_OP',
          narrative: 'Another worker finalized this payment first; no second write was made.',
        },
        '/console/reconciliation': reconciliationBoard,
      }),
    )
    const onToast = vi.fn()
    const user = userEvent.setup()
    render(
      <ReconciliationPage
        onSelectPayment={vi.fn()}
        onNavigate={vi.fn()}
        onToast={onToast}
        onChanged={vi.fn()}
        reloadToken={0}
      />,
    )
    await screen.findByText('Cases')

    await user.click(screen.getByRole('button', { name: /Repair safely/ }))

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        expect.stringContaining('Another worker finalized this payment first'),
        'success',
      ),
    )
  })

  it('surfaces a failed repair as an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              success: false,
              data: null,
              error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found.' },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          )
        }
        void input
        return new Response(
          JSON.stringify({ success: true, data: reconciliationBoard, error: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )
    const onToast = vi.fn()
    const user = userEvent.setup()
    render(
      <ReconciliationPage
        onSelectPayment={vi.fn()}
        onNavigate={vi.fn()}
        onToast={onToast}
        onChanged={vi.fn()}
        reloadToken={0}
      />,
    )
    await screen.findByText('Cases')

    await user.click(screen.getByRole('button', { name: /Repair safely/ }))

    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Payment not found.', 'error'))
  })

  it('opens the evidence behind a case', async () => {
    const onSelectPayment = vi.fn()
    const user = userEvent.setup()
    render(
      <ReconciliationPage
        onSelectPayment={onSelectPayment}
        onNavigate={vi.fn()}
        onToast={vi.fn()}
        onChanged={vi.fn()}
        reloadToken={0}
      />,
    )
    await screen.findByText('Cases')

    await user.click(screen.getByRole('button', { name: 'Open evidence' }))

    expect(onSelectPayment).toHaveBeenCalledWith(reconciliationBoard.cases[0].paymentId)
  })
})
