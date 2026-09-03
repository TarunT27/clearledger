import { AlertCircle, Check, FileText, Minus } from 'lucide-react'
import { useCallback } from 'react'
import { consoleApi } from '../lib/consoleApi'
import { useResource } from '../hooks/useResource'
import { formatFullTimestamp, formatMoney } from '../lib/format'
import {
  ErrorState,
  LoadingRows,
  Money,
  Sheet,
  StatusPill,
  TonePill,
} from './primitives'

/**
 * The evidence drawer.
 *
 * It shows the three things a reviewer needs to defend a decision — which rules fired, what
 * was posted to the ledger, and what the append-only log recorded — and each is fetched
 * from the server rather than reconstructed in the browser, so nothing on screen can be
 * more optimistic than the database.
 */
export function PaymentDetailSheet({
  paymentId,
  onClose,
}: {
  readonly paymentId: string
  readonly onClose: () => void
}) {
  const load = useCallback(
    (signal: AbortSignal) => consoleApi.payment(paymentId, signal),
    [paymentId],
  )
  const { data, error, loading, reload } = useResource(load, [paymentId])

  return (
    <Sheet
      title={data ? data.payment.reference : 'Payment'}
      subtitle={data ? data.payment.description : 'Loading evidence…'}
      onClose={onClose}
      footer={
        data ? (
          <>
            <span>Optimistic-lock version {data.payment.version}</span>
            <span className="mono text-tertiary">{data.payment.id}</span>
          </>
        ) : null
      }
    >
      {loading && !data ? <LoadingRows rows={5} /> : null}
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <section className="sheet__section">
            <div className="row row--between">
              <span className="eyebrow">Summary</span>
              <StatusPill status={data.payment.status} />
            </div>
            <dl className="datalist">
              <dt>Amount</dt>
              <dd>
                <Money
                  amountMinor={data.payment.amountMinor}
                  currency={data.payment.currency}
                />
              </dd>
              <dt>From</dt>
              <dd>
                {data.payment.sender.displayName}
                <span className="text-tertiary"> · {data.payment.sender.reference}</span>
              </dd>
              <dt>To</dt>
              <dd>
                {data.payment.recipient.displayName}
                <span className="text-tertiary"> · {data.payment.recipient.category}</span>
              </dd>
              <dt>Created</dt>
              <dd>{formatFullTimestamp(data.payment.createdAt)}</dd>
              <dt>Last change</dt>
              <dd>{formatFullTimestamp(data.payment.updatedAt)}</dd>
            </dl>
          </section>

          <section className="sheet__section">
            <div className="row row--between">
              <span className="eyebrow">Risk evidence</span>
              <span className="text-caption text-secondary tnum">
                Score {data.payment.riskScore}
              </span>
            </div>
            <div className="stack stack--tight">
              {data.riskSignals.map((signal) => (
                <div
                  key={signal.code}
                  className="row row--between"
                  style={{
                    padding: 'var(--space-3)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-sm)',
                    alignItems: 'flex-start',
                  }}
                >
                  <div className="stack stack--tight" style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 500 }}>{signal.label}</span>
                    <span className="text-caption text-secondary">{signal.explanation}</span>
                  </div>
                  {signal.triggered ? (
                    <TonePill tone="warning">
                      <AlertCircle size={12} aria-hidden="true" /> +{signal.score}
                    </TonePill>
                  ) : (
                    <TonePill tone="neutral">
                      <Minus size={12} aria-hidden="true" /> Clear
                    </TonePill>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="sheet__section">
            <span className="eyebrow">Ledger journal</span>
            {data.journal ? (
              <div className="card card--flush">
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Side</th>
                        <th className="numeric">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.journal.lines.map((line) => (
                        <tr key={`${line.accountId}-${line.direction}`}>
                          <td className="truncate">{line.accountLabel}</td>
                          <td>
                            <TonePill tone={line.direction === 'DEBIT' ? 'info' : 'success'}>
                              {line.direction === 'DEBIT' ? 'Debit' : 'Credit'}
                            </TonePill>
                          </td>
                          <td className="numeric">
                            {formatMoney(line.amountMinor, line.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card__footer">
                  <span className="mono">{data.journal.reference}</span>
                  <span className="row">
                    {data.journal.balanced ? (
                      <TonePill tone="success">
                        <Check size={12} aria-hidden="true" /> Balanced
                      </TonePill>
                    ) : (
                      <TonePill tone="danger">Unbalanced</TonePill>
                    )}
                    {data.journal.matchesPayment ? (
                      <TonePill tone="success">Matches payment</TonePill>
                    ) : (
                      <TonePill tone="danger">Does not match</TonePill>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-footnote text-secondary">
                No journal was posted. The risk decision was {data.payment.riskDecision.toLowerCase()},
                so no money moved and there is nothing for reconciliation to protect.
              </p>
            )}
          </section>

          <section className="sheet__section">
            <span className="eyebrow">Audit trail</span>
            <ol className="timeline">
              {data.audit.map((event) => (
                <li key={event.id} className="timeline__item">
                  <span className="timeline__dot" data-tone={event.tone}>
                    <FileText size={11} aria-hidden="true" />
                  </span>
                  <div className="stack stack--tight">
                    <span className="timeline__title">{event.label}</span>
                    <span className="timeline__detail">{event.detail}</span>
                    <span className="timeline__time">
                      {formatFullTimestamp(event.createdAt)} · {event.actor}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : null}
    </Sheet>
  )
}
