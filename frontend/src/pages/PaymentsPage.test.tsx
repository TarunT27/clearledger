import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentsPage } from './PaymentsPage'
import { mockFetch, page, paymentRow } from '../test/fixtures'

const rows = [
  paymentRow(),
  paymentRow({
    id: 'e1f2a3b4-0000-4000-8000-000000000003',
    reference: 'PAY-E1F20003',
    amountMinor: 1_014_671,
    status: 'REVIEW',
    riskDecision: 'REVIEW',
    riskScore: 50,
    riskSignals: ['UNUSUAL_AMOUNT'],
    journalPosted: false,
    journalId: null,
  }),
]

function pagedResult(pageIndex: number) {
  return {
    items: rows,
    page: pageIndex,
    size: 20,
    totalItems: 44,
    totalPages: 3,
    hasNext: pageIndex < 2,
    hasPrevious: pageIndex > 0,
  }
}

describe('payments page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/console/payments': page(rows) }))
  })

  it('asks the server to sort rather than reordering the current page', async () => {
    const fetchMock = mockFetch({ '/console/payments': page(rows) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <PaymentsPage initialQuery="" onSelectPayment={vi.fn()} onCompose={vi.fn()} reloadToken={0} />,
    )
    await screen.findByText('PAY-E1F20001')

    await user.click(screen.getByRole('button', { name: /Amount/ }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes('sort=amountMinor&direction=DESC'),
        ),
      ).toBe(true),
    )
  })

  it('flips direction when the active column is clicked again', async () => {
    const fetchMock = mockFetch({ '/console/payments': page(rows) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <PaymentsPage initialQuery="" onSelectPayment={vi.fn()} onCompose={vi.fn()} reloadToken={0} />,
    )
    await screen.findByText('PAY-E1F20001')

    await user.click(screen.getByRole('button', { name: /Created/ }))

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          String(call[0]).includes('sort=createdAt&direction=ASC'),
        ),
      ).toBe(true),
    )
  })

  it('sends every filter to the API as a query parameter', async () => {
    const fetchMock = mockFetch({ '/console/payments': page(rows) })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(
      <PaymentsPage initialQuery="" onSelectPayment={vi.fn()} onCompose={vi.fn()} reloadToken={0} />,
    )
    await screen.findByText('PAY-E1F20001')

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'REVIEW')
    await user.selectOptions(screen.getByLabelText('Filter by risk decision'), 'REVIEW')
    await user.selectOptions(screen.getByLabelText('Filter by risk signal'), 'UNUSUAL_AMOUNT')

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => {
          const url = String(call[0])
          return (
            url.includes('status=REVIEW') &&
            url.includes('risk=REVIEW') &&
            url.includes('signal=UNUSUAL_AMOUNT')
          )
        }),
      ).toBe(true),
    )
  })

  it('pages through results using the server-reported totals', async () => {
    let requested = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        requested = Number(new URL(String(input), 'http://test').searchParams.get('page') ?? 0)
        return new Response(
          JSON.stringify({ success: true, data: pagedResult(requested), error: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )
    const user = userEvent.setup()
    render(
      <PaymentsPage initialQuery="" onSelectPayment={vi.fn()} onCompose={vi.fn()} reloadToken={0} />,
    )

    expect(await screen.findByText('44 payments')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByText('Page 2 of 3')).toBeInTheDocument())
    expect(requested).toBe(1)
  })

  it('exports the visible rows with amounts in major units', async () => {
    // jsdom's Blob cannot be read back, so capture what the export hands to it.
    const written: string[] = []
    vi.stubGlobal(
      'Blob',
      class {
        constructor(parts: readonly unknown[]) {
          written.push(String(parts[0]))
        }
      },
    )
    const createObjectURL = vi.fn(() => 'blob:clearledger/csv')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()

    render(
      <PaymentsPage initialQuery="" onSelectPayment={vi.fn()} onCompose={vi.fn()} reloadToken={0} />,
    )
    await screen.findByText('PAY-E1F20001')
    await user.click(screen.getByRole('button', { name: /Export CSV/ }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    const csv = written[0]
    expect(csv).toContain('PAY-E1F20001')
    expect(csv).toContain('250.00')
    expect(csv).toContain('Northstar Supplies')
    expect(csv.split('\r\n')[0]).toContain('Risk signals')
  })

  it('offers a way out when a filter matches nothing', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/console/payments': page([]) }))
    const user = userEvent.setup()
    render(
      <PaymentsPage
        initialQuery="nothing-matches"
        onSelectPayment={vi.fn()}
        onCompose={vi.fn()}
        reloadToken={0}
      />,
    )

    expect(await screen.findByText('No payments match these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull())
  })
})
