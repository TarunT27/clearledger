import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Gauge,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  OperationsFixture,
  OperationsTone,
  RiskDecision,
} from '../lib/operationsData'
import '../styles/operationsPages.css'

export interface RiskPageProps {
  readonly fixture: OperationsFixture
  readonly onSelectPayment: (paymentId: string) => void
}

type DecisionFilter = 'all' | RiskDecision

const decisionOrder: readonly RiskDecision[] = [
  'Approved',
  'Review',
  'Rejected',
  'Unknown',
]

function toneForDecision(decision: RiskDecision): OperationsTone {
  if (decision === 'Approved') return 'success'
  if (decision === 'Review') return 'warning'
  if (decision === 'Rejected') return 'danger'
  return 'neutral'
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function RiskPage({ fixture, onSelectPayment }: RiskPageProps) {
  const [statusFilter, setStatusFilter] = useState<DecisionFilter>('Review')

  const decisionDistribution = useMemo(
    () => decisionOrder.map((decision) => ({
      decision,
      count: fixture.payments.filter((payment) => payment.riskDecision === decision).length,
      tone: toneForDecision(decision),
    })),
    [fixture.payments],
  )

  const queue = useMemo(
    () => fixture.payments.filter((payment) => (
      statusFilter === 'all' || payment.riskDecision === statusFilter
    )),
    [fixture.payments, statusFilter],
  )

  const evaluatedCount = fixture.payments.length
  const approvedCount = decisionDistribution.find(
    (item) => item.decision === 'Approved',
  )?.count ?? 0
  const reviewCount = decisionDistribution.find(
    (item) => item.decision === 'Review',
  )?.count ?? 0
  const rejectedCount = decisionDistribution.find(
    (item) => item.decision === 'Rejected',
  )?.count ?? 0

  return (
    <div className="operations-page operations-page--risk">
      <header className="operations-page__header">
        <div>
          <span className="operations-eyebrow">Decision controls</span>
          <h1>Risk monitoring</h1>
          <p>Monitor policy outcomes, rule pressure, and payments requiring intervention.</p>
        </div>
        <div className="operations-page__summary operations-page__summary--warning">
          <ShieldAlert size={19} aria-hidden="true" />
          <span>
            <strong>{reviewCount}</strong>
            decisions need review
          </span>
        </div>
      </header>

      <section className="risk-kpis" aria-label="Risk decision KPIs">
        <article className="risk-kpi">
          <span className="risk-kpi__icon risk-kpi__icon--info"><Gauge size={18} /></span>
          <div><span>Evaluated</span><strong>{evaluatedCount}</strong></div>
          <small>Current operations set</small>
        </article>
        <article className="risk-kpi">
          <span className="risk-kpi__icon risk-kpi__icon--success"><CheckCircle2 size={18} /></span>
          <div><span>Auto-approved</span><strong>{approvedCount}</strong></div>
          <small>{evaluatedCount ? Math.round((approvedCount / evaluatedCount) * 100) : 0}% of decisions</small>
        </article>
        <article className="risk-kpi">
          <span className="risk-kpi__icon risk-kpi__icon--warning"><CircleAlert size={18} /></span>
          <div><span>Manual review</span><strong>{reviewCount}</strong></div>
          <small>Queued for an operator</small>
        </article>
        <article className="risk-kpi">
          <span className="risk-kpi__icon risk-kpi__icon--danger"><ShieldAlert size={18} /></span>
          <div><span>Rejected</span><strong>{rejectedCount}</strong></div>
          <small>Blocked by policy</small>
        </article>
      </section>

      <div className="risk-monitoring-grid">
        <section className="operations-panel risk-distribution" aria-labelledby="decision-distribution-title">
          <div className="operations-panel__header">
            <div>
              <span className="operations-eyebrow">Current mix</span>
              <h2 id="decision-distribution-title">Decision distribution</h2>
            </div>
            <span className="operations-panel__meta">{evaluatedCount} decisions</span>
          </div>
          <div className="decision-distribution__list">
            {decisionDistribution.map((item) => {
              const share = evaluatedCount ? Math.round((item.count / evaluatedCount) * 100) : 0
              return (
                <div className="decision-distribution__row" key={item.decision}>
                  <div>
                    <span className={`operation-dot operation-dot--${item.tone}`} aria-hidden="true" />
                    <span>{item.decision}</span>
                    <strong>{item.count}</strong>
                  </div>
                  <div
                    className="decision-progress"
                    role="progressbar"
                    aria-label={`${item.decision} decisions`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={share}
                  >
                    <span
                      className={`decision-progress__fill decision-progress__fill--${item.tone}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <small>{share}%</small>
                </div>
              )
            })}
          </div>
        </section>

        <section className="operations-panel risk-rules" aria-labelledby="risk-rules-title">
          <div className="operations-panel__header">
            <div>
              <span className="operations-eyebrow">Policy signals</span>
              <h2 id="risk-rules-title">Rule summaries</h2>
            </div>
            <span className="operations-panel__meta">Last 24 hours</span>
          </div>
          <div className="risk-rule-grid">
            {fixture.riskSignals.slice(0, 4).map((signal) => {
              const TrendIcon = signal.trend <= 0 ? TrendingDown : TrendingUp
              return (
                <article className="risk-rule" key={signal.label}>
                  <div className="risk-rule__topline">
                    <span className={`operation-dot operation-dot--${signal.tone}`} aria-hidden="true" />
                    <span>{signal.label}</span>
                  </div>
                  <strong>{signal.count}</strong>
                  <small className={signal.trend <= 0 ? 'text-success' : 'text-warning'}>
                    <TrendIcon size={13} aria-hidden="true" />
                    {Math.abs(signal.trend)}% vs prior period
                  </small>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      <section className="operations-panel review-queue" aria-labelledby="review-queue-title">
        <div className="operations-panel__header operations-panel__header--toolbar">
          <div>
            <span className="operations-eyebrow">Operator workflow</span>
            <h2 id="review-queue-title">Manual-review queue</h2>
            <p>{queue.length} payments in the selected decision state</p>
          </div>
          <label className="operations-select">
            <span>Risk status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as DecisionFilter)}
            >
              <option value="all">All decisions</option>
              {decisionOrder.map((decision) => (
                <option value={decision} key={decision}>{decision}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="operations-table-scroll">
          <table className="operations-table" aria-label="Manual-review queue">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Merchant</th>
                <th className="numeric">Amount</th>
                <th>Decision</th>
                <th>Score</th>
                <th>Policy</th>
                <th><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((payment) => (
                <tr key={payment.id}>
                  <td><code>{payment.id}</code></td>
                  <td>
                    <strong className="table-primary">{payment.merchant}</strong>
                    <small className="table-secondary">{payment.recipient}</small>
                  </td>
                  <td className="numeric">{formatMoney(payment.amount, payment.currency)}</td>
                  <td>
                    <span className={`operation-badge operation-badge--${toneForDecision(payment.riskDecision)}`}>
                      {payment.riskDecision}
                    </span>
                  </td>
                  <td>{payment.riskEvidence.score.toFixed(2)}</td>
                  <td>{payment.riskEvidence.policy}</td>
                  <td className="table-action">
                    <button
                      type="button"
                      className="operations-icon-link"
                      aria-label={`Open risk evidence for ${payment.id}`}
                      onClick={() => onSelectPayment(payment.id)}
                    >
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {queue.length === 0 ? (
          <div className="operations-empty" role="status">
            <CheckCircle2 size={22} aria-hidden="true" />
            <strong>No payments match this risk status</strong>
            <button
              type="button"
              className="operations-text-button"
              onClick={() => setStatusFilter('Review')}
            >
              Show review queue
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
