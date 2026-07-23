import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('ClearLedger scenario workflows', () => {
  it('completes the normal payment scenario', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /payment timeout/i })
    await user.click(screen.getByRole('button', { name: 'Normal' }))

    expect(await screen.findByRole('heading', { name: /payment approved/i })).toBeInTheDocument()
    expect(screen.getByText(/risk cleared, double-entry posted/i)).toBeInTheDocument()
  })

  it('suppresses a duplicate and exposes exactly one selected ledger result', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /payment timeout/i })
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(await screen.findByRole('heading', { name: /duplicate safely suppressed/i })).toBeInTheDocument()
    expect(screen.getByText(/one payment, one ledger entry/i)).toBeInTheDocument()
    const ledger = screen.getByRole('heading', { name: 'Ledger evidence' }).closest('section')
    expect(ledger).not.toBeNull()
    expect(within(ledger!).getAllByRole('row')).toHaveLength(3)
  })

  it('repairs a timeout without a second ledger write', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /payment timeout/i })
    await user.click(screen.getByRole('button', { name: /run safe reconciliation/i }))

    expect(await screen.findByRole('heading', { name: /payment recovered/i })).toBeInTheDocument()
    expect(screen.getAllByText(/no duplicate ledger write/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /safe repair completed/i })).toBeDisabled()
  })

  it('creates a payment from the composer', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /payment timeout/i })
    await user.type(screen.getByLabelText('Amount'), '4400')
    await user.type(screen.getByLabelText('Recipient'), 'Apex Manufacturing')
    await user.click(screen.getByRole('button', { name: /send payment/i }))

    expect(await screen.findByText('Apex Manufacturing')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Payment approved')
  })
})
