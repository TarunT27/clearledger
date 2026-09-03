import { Activity, ArrowRight, BookOpen, ShieldAlert } from 'lucide-react'
import { useCallback } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { RangeId, ThroughputBucket } from '../lib/consoleTypes'
import {
  formatCount,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatRelative,
} from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Meter,
  MetricCard,
  Money,
  PageHeader,
  RefreshButton,
  Segmented,
  SeverityPill,
  StatusPill,
} from '../components/primitives'
import type { ViewId } from '../components/AppShell'

const RANGES = [
  { value: '24h' as const, label: '24 hours' },
  { value: '7d' as const, label: '7 days' },
  { value: '30d' as const, label: '30 days' },
]

const SERIES = [
  { key: 'approved', label: 'Approved', className: 'approved', color: 'var(--series-approved)' },
  { key: 'review', label: 'Review', className: 'review', color: 'var(--series-review)' },
  { key: 'rejected', label: 'Rejected', className: 'rejected', color: 'var(--series-rejected)' },
  { key: 'pending', label: 'Pending', className: 'pending', color: 'var(--series-pending)' },
] as const

export interface OverviewPageProps {
  readonly range: RangeId
  readonly onRangeChange: (range: RangeId) => void
  readonly onNavigate: (view: ViewId) => void
  readonly onSelectPayment: (paymentId: string) => void
}

export function OverviewPage({
  range,
  onRangeChange,
  onNavigate,
  onSelectPayment,
}: OverviewPageProps) {
  const load = useCallback((signal: AbortSignal) => consoleApi.overview(range, signal), [range])
  const { data, error, loading, refreshing, reload } = useResource(load, [range], {
    pollMs: 30_000,
  })

  return (
    <main className="page">
      <PageHeader
        eyebrow="Payment operations"
        title="Operations overview"
        lede="Decision mix, posting integrity, and recovery work, computed from the ledger itself."
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

      {loading && !data ? (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="skeleton" style={{ height: 118, borderRadius: 16 }} />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
          >
            {data.metrics.map((metric) => (
              <MetricCard
                key={metric.key}
                metric={metric}
                currency={data.ledgerHealth.currency}
              />
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
            <section className="card">
              <div className="card__header">
                <div>
                  <div className="eyebrow">Decision throughput</div>
                  <h2 className="card__title">Payment activity</h2>
                  <p className="card__subtitle">
                    {data.rangeLabel} · window opened {formatDateTime(data.windowStart)}
                  </p>
                </div>
                <div className="legend">
                  {SERIES.map((series) => (
                    <span key={series.key} className="legend__item">
                      <span
                        className="legend__swatch"
                        style={{ background: series.color }}
                        aria-hidden="true"
                      />
                      {series.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card__body">
                <ThroughputChart buckets={data.throughput} />
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <div className="eyebrow">Current window</div>
                  <h2 className="card__title">Decision mix</h2>
                </div>
                <Activity size={16} className="text-tertiary" aria-hidden="true" />
              </div>
              <div className="card__body stack">
                {data.decisionMix.map((slice) => (
                  <Meter
                    key={slice.key}
                    label={slice.label}
                    value={slice.count}
                    total={data.decisionMix.reduce((sum, item) => sum + item.count, 0)}
                    color={
                      SERIES.find((series) => series.label === slice.label)?.color ??
                      'var(--series-pending)'
                    }
                  />
                ))}
              </div>
              <div className="card__footer">
                <span>Risk rule activity</span>
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => onNavigate('risk')}
                >
                  Open risk
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)' }}>
            <section className="card card--flush">
              <div className="card__header">
                <div>
                  <div className="eyebrow">Recovery queue</div>
                  <h2 className="card__title">Reconciliation exceptions</h2>
                  <p className="card__subtitle">
                    Payments whose status is still pending after their initiation committed.
                  </p>
                </div>
                {data.exceptions.length > 0 ? (
                  <span className="pill pill--warning">{data.exceptions.length} open</span>
                ) : null}
              </div>
              {data.exceptions.length === 0 ? (
                <EmptyState
                  icon={<ShieldAlert size={20} aria-hidden="true" />}
                  title="No open exceptions"
                  body="Every payment in the ledger has reached a final status. The scenario lab can create a timeout if you want to watch a repair."
                  action={
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => onNavigate('scenario-lab')}
                    >
                      Open scenario lab
                    </button>
                  }
                />
              ) : (
                <div className="table-scroll">
                  <table className="table table--interactive">
                    <thead>
                      <tr>
                        <th>Payment</th>
                        <th>Recipient</th>
                        <th className="numeric">Amount</th>
                        <th>Journal</th>
                        <th>Age</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exceptions.map((payment) => (
                        <tr
                          key={payment.id}
                          onClick={() => onSelectPayment(payment.id)}
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') onSelectPayment(payment.id)
                          }}
                        >
                          <td>
                            <span className="mono">{payment.reference}</span>
                          </td>
                          <td className="truncate">{payment.recipient.displayName}</td>
                          <td className="numeric">
                            <Money amountMinor={payment.amountMinor} currency={payment.currency} />
                          </td>
                          <td>
                            {payment.journalPosted ? (
                              <SeverityPill severity="High" />
                            ) : (
                              <StatusPill status="PENDING" label="No journal" />
                            )}
                          </td>
                          <td className="text-secondary">{formatRelative(payment.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="card__footer">
                <span>Repairs are compare-and-swap guarded</span>
                <button
                  type="button"
                  className="btn btn--quiet"
                  onClick={() => onNavigate('reconciliation')}
                >
                  Open workbench
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </section>

            <div className="stack">
              <section className="card">
                <div className="card__header">
                  <div>
                    <div className="eyebrow">Policy signals</div>
                    <h2 className="card__title">Risk rule activity</h2>
                  </div>
                </div>
                <div className="card__body stack">
                  {data.signalActivity.every((signal) => signal.count === 0) ? (
                    <p className="text-footnote text-secondary">
                      No risk rule fired in this window.
                    </p>
                  ) : (
                    data.signalActivity.map((signal) => (
                      <Meter
                        key={signal.code}
                        label={signal.label}
                        value={signal.count}
                        total={Math.max(
                          ...data.signalActivity.map((item) => item.count),
                          1,
                        )}
                        color="var(--accent)"
                        trailing={
                          <>
                            {formatCount(signal.count)}{' '}
                            <span className="text-tertiary">
                              {signal.previousCount === 0
                                ? 'new'
                                : `was ${formatCount(signal.previousCount)}`}
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
                    <div className="eyebrow">Posting integrity</div>
                    <h2 className="card__title">Ledger health</h2>
                  </div>
                  <BookOpen size={16} className="text-tertiary" aria-hidden="true" />
                </div>
                <div className="card__body">
                  <dl className="datalist">
                    <dt>Journals</dt>
                    <dd>{formatCount(data.ledgerHealth.journals)}</dd>
                    <dt>Balanced</dt>
                    <dd>
                      {formatCount(data.ledgerHealth.balancedJournals)}{' '}
                      <span className="text-tertiary">
                        {formatPercent(
                          data.ledgerHealth.journals === 0
                            ? 100
                            : (data.ledgerHealth.balancedJournals /
                                data.ledgerHealth.journals) *
                                100,
                          1,
                        )}
                      </span>
                    </dd>
                    <dt>Posted value</dt>
                    <dd>
                      {formatMoney(
                        data.ledgerHealth.postedVolumeMinor,
                        data.ledgerHealth.currency,
                      )}
                    </dd>
                    <dt>Last posting</dt>
                    <dd>{formatRelative(data.ledgerHealth.lastPostedAt)}</dd>
                  </dl>
                </div>
                <div className="card__footer">
                  <span>
                    {data.ledgerHealth.balancedJournals === data.ledgerHealth.journals
                      ? 'Every journal balances'
                      : 'Unbalanced journals present'}
                  </span>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => onNavigate('ledger')}
                  >
                    Open ledger
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </section>
            </div>
          </div>
        </>
      ) : null}

      {loading && !data ? <LoadingRows rows={4} height={120} /> : null}
    </main>
  )
}

function ThroughputChart({ buckets }: { readonly buckets: readonly ThroughputBucket[] }) {
  const peak = Math.max(
    1,
    ...buckets.map((bucket) => bucket.approved + bucket.review + bucket.rejected + bucket.pending),
  )

  if (buckets.every((bucket) => bucket.approved + bucket.review + bucket.rejected + bucket.pending === 0)) {
    return (
      <EmptyState
        title="No payments in this window"
        body="Widen the reporting window, or create a payment from the payments page."
      />
    )
  }

  return (
    <div>
      <div className="bars">
        {buckets.map((bucket) => {
          const total = bucket.approved + bucket.review + bucket.rejected + bucket.pending
          return (
            <div
              key={bucket.startsAt}
              className="bars__column"
              title={`${bucket.label}: ${total} payment${total === 1 ? '' : 's'}, ${formatMoneyCompact(bucket.volumeMinor)}`}
            >
              <div className="bars__stack">
                {SERIES.map((series) => {
                  const value = bucket[series.key]
                  if (value === 0) return null
                  return (
                    <div
                      key={series.key}
                      className={`bars__segment bars__segment--${series.className}`}
                      style={{ height: `${(value / peak) * 100}%` }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="bars" style={{ height: 'auto', paddingTop: 0 }}>
        {buckets.map((bucket, index) => (
          <div key={bucket.startsAt} className="bars__label">
            {buckets.length > 14 && index % 3 !== 0 ? '' : bucket.label}
          </div>
        ))}
      </div>
    </div>
  )
}
