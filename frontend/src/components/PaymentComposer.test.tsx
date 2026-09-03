import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentComposer } from './PaymentComposer'
import { mockFetch, paymentRow, recipientParty, senderParty } from '../test/fixtures'

const ROUTES = {
  '/console/counterparties?role=SENDER': [senderParty],
  '/console/counterparties?role=RECIPIENT': [recipientParty],
  '/payments': paymentRow(),
}

describe('payment composer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(ROUTES))
  })

  it('loads real counterparties rather than free-text names', async () => {
    render(<PaymentComposer onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />)

    expect(
      await screen.findByRole('option', { name: /Atlas Operating/ }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: /Northstar Supplies/ })).toBeInTheDocument()
  })

  it('blocks submission until the amount is a positive number', async () => {
    const user = userEvent.setup()
    render(<PaymentComposer onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />)
    await screen.findByRole('option', { name: /Atlas Operating/ })

    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '0')

    expect(screen.getByText('Enter an amount greater than zero.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create payment' })).toBeDisabled()
  })

  it('converts the entered amount to integer minor units', async () => {
    const fetchMock = mockFetch(ROUTES)
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<PaymentComposer onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />)
    await screen.findByRole('option', { name: /Atlas Operating/ })

    const amount = screen.getByLabelText('Amount')
    await user.clear(amount)
    await user.type(amount, '1234.56')
    await user.click(screen.getByRole('button', { name: 'Create payment' }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find((call) => (call[1] as RequestInit)?.method === 'POST')
      expect(JSON.parse(String((post?.[1] as RequestInit).body))).toMatchObject({
        amountMinor: 123_456,
      })
    })
  })

  it('regenerates the idempotency key on request', async () => {
    const user = userEvent.setup()
    render(<PaymentComposer onClose={vi.fn()} onCreated={vi.fn()} onError={vi.fn()} />)
    await screen.findByRole('option', { name: /Atlas Operating/ })

    const before = screen.getByText(/^console-/).textContent
    await user.click(screen.getByRole('button', { name: 'Regenerate' }))

    expect(screen.getByText(/^console-/).textContent).not.toBe(before)
  })

  it('reports a rejected payment through the error channel instead of closing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              success: false,
              data: null,
              error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Key reused with a different body.' },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          )
        }
        const url = String(input)
        const role = url.includes('SENDER') ? [senderParty] : [recipientParty]
        return new Response(JSON.stringify({ success: true, data: role, error: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )

    const onError = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PaymentComposer onClose={onClose} onCreated={vi.fn()} onError={onError} />)
    await screen.findByRole('option', { name: /Atlas Operating/ })

    await user.click(screen.getByRole('button', { name: 'Create payment' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Key reused with a different body.'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
