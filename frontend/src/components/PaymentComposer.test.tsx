import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PaymentComposer } from './PaymentComposer'

describe('PaymentComposer', () => {
  it('validates amount and recipient at the boundary', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PaymentComposer busy={false} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /send payment/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Amount'), '1250')
    await user.click(screen.getByRole('button', { name: /send payment/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid recipient')
  })

  it('submits a validated request with an idempotency key', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<PaymentComposer busy={false} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Amount'), '1250.75')
    await user.type(screen.getByLabelText('Recipient'), 'Northstar Supplies')
    await user.click(screen.getByRole('button', { name: /send payment/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1250.75,
      currency: 'USD',
      recipient: 'Northstar Supplies',
      idempotencyKey: expect.stringMatching(/^ui_/),
    }))
  })
})
