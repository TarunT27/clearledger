import { Search, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { CreatePaymentInput } from '../types'

interface PaymentComposerProps {
  readonly busy: boolean
  readonly onSubmit: (input: CreatePaymentInput) => Promise<void>
}

const makeIdempotencyKey = () => `ui_${crypto.randomUUID()}`

export function PaymentComposer({ busy, onSubmit }: PaymentComposerProps) {
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000) {
      setError('Enter an amount between $0.01 and $1,000,000.')
      return
    }
    if (recipient.trim().length < 3) {
      setError('Enter a valid recipient or account.')
      return
    }

    setError('')
    await onSubmit({
      amount: parsedAmount,
      currency: 'USD',
      recipient: recipient.trim(),
      idempotencyKey: makeIdempotencyKey(),
    })
    setAmount('')
    setRecipient('')
  }

  return (
    <form className="payment-composer" onSubmit={submit} aria-label="Create payment">
      <div className="composer-field composer-field--amount">
        <label htmlFor="amount">Amount</label>
        <div className="input-frame">
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            aria-describedby={error ? 'composer-error' : undefined}
          />
          <span className="currency">USD</span>
        </div>
      </div>
      <div className="composer-field composer-field--recipient">
        <label htmlFor="recipient">Recipient</label>
        <div className="input-frame">
          <input
            id="recipient"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder="Search recipient or account…"
            aria-describedby={error ? 'composer-error' : undefined}
          />
          <Search size={17} aria-hidden="true" />
        </div>
      </div>
      <button className="button button--primary composer-submit" type="submit" disabled={busy}>
        <Send size={18} aria-hidden="true" />
        <span>{busy ? 'Processing…' : 'Send payment'}</span>
      </button>
      {error ? <p className="composer-error" id="composer-error" role="alert">{error}</p> : null}
    </form>
  )
}
