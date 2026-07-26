import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  OperationsFixture,
  OperationsTone,
  OverviewRange,
  PaymentRecord,
} from '../lib/operationsData'
import '../styles/overview.css'

export interface OverviewPageProps {
  readonly data: OperationsFixture
  readonly onNavigate: (view: 'payments' | 'risk' | 'reconciliation') => void
  readonly onSelectPayment: (id: string) => void
}

const ranges: readonly { value: OverviewRange; label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
]

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const exactMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

const shortTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

function formatTime(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : shortTime.format(timestamp)
}

function toneClass(tone: OperationsTone): string {
  return `overview-tone overview-tone--${tone}`
}

function StatusBadge({ payment }: { readonly payment: PaymentRecord }) {
  return (
    <span className={toneClass(payment.statusTone)}>
      <span aria-hidden="true" />
      {payment.status}
    </span>
  )
}

export function OverviewPage({ data, onNavigate, onSelectPayment }: OverviewPageProps) {
  const [range, setRange] = useState<OverviewRange>('24h')
  const [refreshedAt, setRefreshedAt] = useState(data.generatedAt)
  const snapshot = data.overview[range]

  const openCases = useMemo(
    () => data.reconciliationCases.filter((item) => item.state !== 'Repaired').slice(0, 4),
    [data.reconciliationCases],
  )
  const balancedJournalCount = useMemo(
    () => data.journals.filter((journal) => journal.balanced).length,
    [data.journals],
  )
  const recentPayments = data.payments.slice(0, 6)
  const totalStatuses = data.statusDistribution.reduce((sum, item) => sum + item.count, 0)
  const chartMaximum = Math.max(
    ...snapshot.chartPoints.map((point) => point.approved + point.review + point.rejected),
    1,
  )

  return (
    <div className="overview-page">
      <header className="overview-page__header">
        <div>
          <p className="overview-page__eyebrow">Payment operations</p>
          <h1>Operations overview</h1>
          <p>Monitor payment decisions, posting integrity, and recovery work in real time.</p>
        </div>
        <div className="overview-page__controls">
          <div className="overview-page__range" aria-label="Overview time range">
            {ranges.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={range === item.value}
                onClick={() => setRange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            className="overview-page__refresh"
            type="button"
            onClick={() => setRefreshedAt(new Date().toISOString())}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <div className="overview-page__freshness" role="status">
        <span aria-hidden="true" />
        Live operations snapshot
        <time dateTime={refreshedAt}>Updated {formatTime(refreshedAt)}</time>
      </div>

      <section className="overview-kpis" aria-label="Key payment metrics">
        <article>
          <div className="overview-kpis__icon"><WalletCards size={19} aria-hidden="true" /></div>
          <div>
            <span>Processed volume</span>
            <strong>{money.format(snapshot.kpis.paymentVolume)}</strong>
            <small className="is-positive">
              <TrendingUp size={13} aria-hidden="true" />
              {snapshot.kpis.paymentVolumeDelta}% vs prior period
            </small>
          </div>
        </article>
        <article>
          <div className="overview-kpis__icon"><CheckCircle2 size={19} aria-hidden="true" /></div>
          <div>
            <span>Approval rate</span>
            <strong>{snapshot.kpis.approvalRate}%</strong>
            <small className="is-positive">
              <TrendingUp size={13} aria-hidden="true" />
              {snapshot.kpis.approvalRateDelta}% vs prior period
            </small>
          </div>
        </article>
        <article>
          <div className="overview-kpis__icon overview-kpis__icon--warning">
            <ShieldAlert size={19} aria-hidden="true" />
          </div>
          <div>
            <span>Manual review</span>
            <strong>{snapshot.kpis.manualReview}</strong>
            <small>{snapshot.kpis.manualReviewDelta}% vs prior period</small>
          </div>
        </article>
        <article>
          <div className="overview-kpis__icon overview-kpis__icon--danger">
            <RefreshCw size={19} aria-hidden="true" />
          </div>
          <div>
            <span>Open exceptions</span>
            <strong>{snapshot.kpis.reconciliationExceptions}</strong>
            <small>{snapshot.kpis.reconciliationExceptionsDelta}% vs prior period</small>
          </div>
        </article>
      </section>

      <div className="overview-layout">
        <section className="overview-panel overview-panel--activity" aria-labelledby="activity-title">
          <header className="overview-panel__header">
            <div>
              <p>Decision throughput</p>
              <h2 id="activity-title">Payment activity</h2>
            </div>
            <div className="overview-legend" aria-label="Chart legend">
              <span className="is-approved">Approved</span>
              <span className="is-review">Review</span>
              <span className="is-rejected">Rejected</span>
            </div>
          </header>
          <div className="overview-chart" role="img" aria-label={`Payment decisions over ${snapshot.label}`}>
            {snapshot.chartPoints.map((point) => {
              const total = point.approved + point.review + point.rejected
              return (
                <div className="overview-chart__column" key={point.label}>
                  <div className="overview-chart__value">{total}</div>
                  <div className="overview-chart__track" style={{ height: `${Math.max(18, (total / chartMaximum) * 100)}%` }}>
                    <span
                      className="is-approved"
                      style={{ height: `${(point.approved / total) * 100}%` }}
                      title={`${point.approved} approved`}
                    />
                    <span
                      className="is-review"
                      style={{ height: `${(point.review / total) * 100}%` }}
                      title={`${point.review} in review`}
                    />
                    <span
                      className="is-rejected"
                      style={{ height: `${(point.rejected / total) * 100}%` }}
                      title={`${point.rejected} rejected`}
                    />
                  </div>
                  <span>{point.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="overview-panel overview-panel--distribution" aria-labelledby="distribution-title">
          <header className="overview-panel__header">
            <div>
              <p>Current window</p>
              <h2 id="distribution-title">Decision mix</h2>
            </div>
            <Activity size={18} aria-hidden="true" />
          </header>
          <div className="overview-distribution">
            {data.statusDistribution.map((item) => {
              const percentage = totalStatuses ? Math.round((item.count / totalStatuses) * 100) : 0
              return (
                <div key={item.label}>
                  <span className={toneClass(item.tone)}>{item.label}</span>
                  <strong>{item.count}</strong>
                  <small>{percentage}%</small>
                  <div aria-hidden="true">
                    <span className={`is-${item.tone}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="overview-link-button" onClick={() => onNavigate('risk')}>
            Open risk monitoring <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>

        <section className="overview-panel overview-panel--exceptions" aria-labelledby="exceptions-title">
          <header className="overview-panel__header">
            <div>
              <p>Recovery queue</p>
              <h2 id="exceptions-title">Reconciliation exceptions</h2>
            </div>
            <span className="overview-count">{openCases.length} open</span>
          </header>
          <div className="overview-exceptions">
            {openCases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate('reconciliation')}
                aria-label={`Review reconciliation case ${item.paymentId}`}
              >
                <span className={`overview-severity overview-severity--${item.severity.toLowerCase()}`}>
                  {item.severity}
                </span>
                <span>
                  <strong>{item.paymentId}</strong>
                  <small>{item.merchant}</small>
                </span>
                <span>
                  <strong>{item.reason}</strong>
                  <small><Clock3 size={12} aria-hidden="true" /> {item.age}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <button type="button" className="overview-link-button" onClick={() => onNavigate('reconciliation')}>
            Open reconciliation workbench <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>

        <section className="overview-panel overview-panel--signals" aria-labelledby="signals-title">
          <header className="overview-panel__header">
            <div>
              <p>Policy signals</p>
              <h2 id="signals-title">Risk rule activity</h2>
            </div>
            <ShieldAlert size={18} aria-hidden="true" />
          </header>
          <div className="overview-signals">
            {data.riskSignals.map((signal) => (
              <div key={signal.label}>
                <span className={`overview-signal-dot is-${signal.tone}`} aria-hidden="true" />
                <span>
                  <strong>{signal.label}</strong>
                  <small>{signal.trend > 0 ? '+' : ''}{signal.trend}% from baseline</small>
                </span>
                <strong>{signal.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="overview-panel overview-panel--payments" aria-labelledby="recent-payments-title">
          <header className="overview-panel__header">
            <div>
              <p>Latest decisions</p>
              <h2 id="recent-payments-title">Recent payments</h2>
            </div>
            <button type="button" className="overview-link-button" onClick={() => onNavigate('payments')}>
              View all <ArrowRight size={15} aria-hidden="true" />
            </button>
          </header>
          <div className="overview-table-wrap">
            <table aria-label="Recent payments">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Recipient</th>
                  <th>Amount</th>
                  <th>Decision</th>
                  <th>Created</th>
                  <th><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td><code>{payment.id}</code></td>
                    <td>
                      <strong>{payment.recipient}</strong>
                      <small>{payment.description}</small>
                    </td>
                    <td>{exactMoney.format(payment.amount)}</td>
                    <td><StatusBadge payment={payment} /></td>
                    <td>{formatTime(payment.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onSelectPayment(payment.id)}
                        aria-label={`View payment ${payment.id}`}
                      >
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="overview-page__health">
        <span><CheckCircle2 size={15} aria-hidden="true" /> Snapshot integrity verified</span>
        <span><CheckCircle2 size={15} aria-hidden="true" /> {balancedJournalCount} balanced journals verified</span>
        <span><CheckCircle2 size={15} aria-hidden="true" /> {data.reconciliationCases.length} reconciliation cases tracked</span>
        <span><CreditCard size={15} aria-hidden="true" /> {data.payments.length} payments in current dataset</span>
      </footer>
    </div>
  )
}

export default OverviewPage
