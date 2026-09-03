import { Gauge, ShieldCheck } from 'lucide-react'
import { useCallback } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { PaymentRow, RangeId } from '../lib/consoleTypes'
import { formatCount, formatDateTime, formatMoney, formatPercent } from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Meter,
  Money,
  PageHeader,
  RefreshButton,
  Segmented,
  StatusPill,
} from '../components/primitives'

const RANGES = [
  { value: '24h' as const, label: '24 hours' },
  { value: '7d' as const, label: '7 days' },
  { value: '30d' as const, label: '30 days' },
]

export interface RiskPageProps {
  readonly range: RangeId
  readonly onRangeChange: (range: RangeId) => void
  readonly onSelectPayment: (paymentId: string) => void
  readonly reloadToken: number
}

/**
 * The risk workbench.
 *
 * The policy panel reports the thresholds the engine is actually compiled with — they are
 * read from the running engine and sent down with the report — so the page cannot drift
 * out of step with the rules the way a hand-written summary would.
 */
export function RiskPage({ range, onRangeChange, onSelectPayment, reloadToken }: RiskPageProps) {
  const load = useCallback((signal: AbortSignal) => consoleApi.risk(range, signal), [range])
  const { data, error, loading, refreshing, reload } = useResource(load, [range, reloadToken])

  return (
    <main className="page">
      <PageHeader
        eyebrow="Policy"
        title="Risk"
        lede="Which rules fired, what they cost a payment, and who is waiting on a human."
        tools={
          <>
            <Segmented
              options={RANGES}
              value={range}
              onChange={onRangeChange}
              label="Reporting window"
            />
            <RefreshButton onClick={reload} busy={refreshing} />
          </>
        }
      />

      {error && !data ? (
        <div className="card">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : null}
      {loading && !data ? <LoadingRows rows={5} height={80} /> : null}

      {data ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 1fr)' }}>
            <section className="card">
              <div className="card__header">
                <div>
                  <div className="eyebrow">{data.rangeLabel}</div>
                  <h2 className="card__title">Signal activity</h2>
                  <p className="card__subtitle">
                    {formatCount(data.assessedPayments)} payments assessed · average score{' '}
                    {data.averageScore.toFixed(1)}
                  </p>
                </div>
                <Gauge size={16} className="text-tertiary" aria-hidden="true" />
              </div>
              <div className="card__body stack">
                {data.signals.every((signal) => signal.count === 0) ? (
                  <p className="text-footnote text-secondary">
                    Nothing fired in this window — every payment cleared all four rules.
                  </p>
                ) : (
                  data.signals.map((signal) => (
                    <Meter
                      key={signal.code}
                      label={signal.label}
                      value={signal.count}
                      total={Math.max(...data.signals.map((item) => item.count), 1)}
                      color="var(--accent)"
                      trailing={
                        <>
                          {formatCount(signal.count)}{' '}
                          <span className="text-tertiary">
                            {formatPercent(signal.share, 0)} of signals
                          </span>
                        </>
                      }
                    />
                  ))
                )}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <div className="eyebrow">Live thresholds</div>
                  <h2 className="card__title">Policy in force</h2>
                  <p className="card__subtitle">Read from the running risk engine.</p>
                </div>
                <ShieldCheck size={16} className="text-tertiary" aria-hidden="true" />
              </div>
              <div className="card__body">
                <dl className="datalist">
                  <dt>Unusual amount</dt>
                  <dd>at or above {formatMoney(data.policy.unusualAmountMinor)}</dd>
                  <dt>Repeated attempts</dt>
                  <dd>
                    {data.policy.repeatedAttemptLimit} or more in{' '}
                    {data.policy.attemptWindowMinutes} minutes
                  </dd>
                  <dt>New recipient</dt>
                  <dd>no earlier approved payment to this party</dd>
                  <dt>Velocity limit</dt>
                  <dd>
                    over {formatMoney(data.policy.velocityLimitMinor)} approved in{' '}
                    {data.policy.velocityWindowMinutes / 60} hour
                  </dd>
                  <dt>Review at</dt>
                  <dd>score {data.policy.reviewScoreThreshold} or higher</dd>
                  <dt>Reject at</dt>
                  <dd>any velocity breach, regardless of score</dd>
                </dl>
              </div>
            </section>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
            <QueueCard
              eyebrow="Awaiting an analyst"
              title="Review queue"
              empty="No payment is waiting on a human right now."
              rows={data.reviewQueue}
              onSelectPayment={onSelectPayment}
            />
            <QueueCard
              eyebrow="Blocked by policy"
              title="Rejected"
              empty="No payment has been rejected in this book."
              rows={data.rejectedQueue}
              onSelectPayment={onSelectPayment}
            />
          </div>
        </>
      ) : null}
    </main>
  )
}

function QueueCard({
  eyebrow,
  title,
  empty,
  rows,
  onSelectPayment,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly empty: string
  readonly rows: readonly PaymentRow[]
  readonly onSelectPayment: (paymentId: string) => void
}) {
  return (
    <section className="card card--flush">
      <div className="card__header">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="card__title">{title}</h2>
        </div>
        {rows.length > 0 ? <span className="pill pill--neutral">{rows.length}</span> : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Queue is clear" body={empty} />
      ) : (
        <div className="table-scroll">
          <table className="table table--interactive">
            <thead>
              <tr>
                <th>Payment</th>
                <th className="numeric">Amount</th>
                <th>Signals</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => (
                <tr
                  key={payment.id}
                  tabIndex={0}
                  onClick={() => onSelectPayment(payment.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSelectPayment(payment.id)
                  }}
                >
                  <td>
                    <div className="stack stack--tight">
                      <span className="mono">{payment.reference}</span>
                      <span className="text-caption text-tertiary truncate">
                        {payment.recipient.displayName}
                      </span>
                    </div>
                  </td>
                  <td className="numeric">
                    <Money amountMinor={payment.amountMinor} currency={payment.currency} />
                  </td>
                  <td className="text-caption text-secondary">
                    {payment.riskSignals.length === 0
                      ? '—'
                      : payment.riskSignals
                          .map((code) => code.toLowerCase().replace(/_/g, ' '))
                          .join(', ')}
                  </td>
                  <td>
                    <StatusPill status={payment.status} />
                  </td>
                  <td className="text-secondary">{formatDateTime(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
