import { KeyRound } from 'lucide-react'
import { type FormEvent, useCallback, useMemo, useState } from 'react'
import { consoleApi, newIdempotencyKey } from '../lib/consoleApi'
import { useResource } from '../hooks/useResource'
import { Sheet, Spinner } from './primitives'

export interface PaymentComposerProps {
  readonly onClose: () => void
  readonly onCreated: (reference: string, duplicate: boolean) => void
  readonly onError: (message: string) => void
}

/**
 * Creates a payment through the public `/api/v1/payments` endpoint.
 *
 * The idempotency key is generated once per composed payment and shown to the operator,
 * because it is the thing that makes a retry safe. Submitting twice with the same key
 * returns the original payment rather than moving money again, and the form says so.
 */
export function PaymentComposer({ onClose, onCreated, onError }: PaymentComposerProps) {
  const loadSenders = useCallback(
    (signal: AbortSignal) => consoleApi.counterparties('SENDER', signal),
    [],
  )
  const loadRecipients = useCallback(
    (signal: AbortSignal) => consoleApi.counterparties('RECIPIENT', signal),
    [],
  )
  const senders = useResource(loadSenders, [])
  const recipients = useResource(loadRecipients, [])

  const [senderId, setSenderId] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [amount, setAmount] = useState('250.00')
  const [currency, setCurrency] = useState('USD')
  const [description, setDescription] = useState('Invoice CL-5001')
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey())
  const [submitting, setSubmitting] = useState(false)

  const effectiveSender = senderId || senders.data?.[0]?.id || ''
  const effectiveRecipient = recipientId || recipients.data?.[0]?.id || ''

  const amountMinor = useMemo(() => {
    const parsed = Number.parseFloat(amount)
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN
  }, [amount])

  const amountError =
    Number.isNaN(amountMinor) || amountMinor <= 0
      ? 'Enter an amount greater than zero.'
      : null
  const ready =
    !amountError && effectiveSender !== '' && effectiveRecipient !== '' &&
    effectiveSender !== effectiveRecipient && description.trim().length > 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || submitting) return
    setSubmitting(true)
    try {
      const created = await consoleApi.createPayment({
        senderId: effectiveSender,
        recipientId: effectiveRecipient,
        amountMinor,
        currency,
        description: description.trim(),
        idempotencyKey,
      })
      onCreated(created.reference, false)
      setIdempotencyKey(newIdempotencyKey())
      onClose()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'The payment could not be created.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      title="New payment"
      subtitle="Submitted through the same API an integrator would call."
      onClose={onClose}
    >
      <form id="composer" className="stack" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="composer-sender">
            From account
          </label>
          <select
            id="composer-sender"
            className="select"
            value={effectiveSender}
            onChange={(event) => setSenderId(event.target.value)}
          >
            {senders.data?.map((party) => (
              <option key={party.id} value={party.id}>
                {party.displayName} · {party.category}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="composer-recipient">
            Recipient
          </label>
          <select
            id="composer-recipient"
            className="select"
            value={effectiveRecipient}
            onChange={(event) => setRecipientId(event.target.value)}
          >
            {recipients.data?.map((party) => (
              <option key={party.id} value={party.id}>
                {party.displayName} · {party.country}
              </option>
            ))}
          </select>
          <span className="field__hint">
            Paying a recipient with no earlier approved payment triggers the new-recipient rule.
          </span>
        </div>

        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 2 }}>
            <label className="field__label" htmlFor="composer-amount">
              Amount
            </label>
            <input
              id="composer-amount"
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {amountError ? <span className="field__error">{amountError}</span> : null}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field__label" htmlFor="composer-currency">
              Currency
            </label>
            <select
              id="composer-currency"
              className="select"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="composer-description">
            Description
          </label>
          <input
            id="composer-description"
            className="input"
            maxLength={140}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="field">
          <span className="field__label">Idempotency key</span>
          <div
            className="row"
            style={{
              padding: 'var(--space-3)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <KeyRound size={14} className="text-tertiary" aria-hidden="true" />
            <span className="mono truncate" style={{ flex: 1 }}>
              {idempotencyKey}
            </span>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setIdempotencyKey(newIdempotencyKey())}
            >
              Regenerate
            </button>
          </div>
          <span className="field__hint">
            Replaying this key with the same body returns the original payment instead of
            creating a second one.
          </span>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {submitting ? <Spinner label="Submitting…" /> : null}
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!ready || submitting}>
            Create payment
          </button>
        </div>
      </form>
    </Sheet>
  )
}
