import { Check, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
import type { Payment, Reconciliation } from '../types'
import { StatusPill } from './StatusPill'
import { toneForDecision } from '../lib/demoApi'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

function KeyValue({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="key-value">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function EvidenceRail({
  payment,
  reconciliation,
  busy,
  onReconcile,
}: {
  readonly payment: Payment
  readonly reconciliation: Reconciliation | null
  readonly busy: boolean
  readonly onReconcile: () => void
}) {
  const debitTotal = payment.ledgerLines
    .filter((line) => line.side === 'Debit')
    .reduce((sum, line) => sum + line.amount, 0)
  const creditTotal = payment.ledgerLines
    .filter((line) => line.side === 'Credit')
    .reduce((sum, line) => sum + line.amount, 0)

  return (
    <aside className="evidence-rail" aria-label={`Evidence for ${payment.id}`}>
      <section className="evidence-card">
        <div className="evidence-card__heading">
          <h2>Risk evidence</h2>
          <StatusPill tone={toneForDecision(payment.riskEvidence.decision)}>
            {payment.riskEvidence.decision}
          </StatusPill>
        </div>
        <dl>
          <KeyValue label="Decision"><span className="text-success">{payment.riskEvidence.decision}</span></KeyValue>
          <KeyValue label="Score">{payment.riskEvidence.score.toFixed(2)}</KeyValue>
          <KeyValue label="Policy">{payment.riskEvidence.policy}</KeyValue>
          {payment.riskEvidence.signals.map((signal) => (
            <KeyValue key={signal.label} label={signal.label}>
              <span className={`text-${signal.tone}`}>{signal.outcome}</span>
            </KeyValue>
          ))}
          <KeyValue label="Timestamp">{payment.riskEvidence.timestamp}</KeyValue>
        </dl>
      </section>

      <section className="evidence-card">
        <div className="evidence-card__heading">
          <h2>Ledger evidence</h2>
          <span className="ledger-seal"><ShieldCheck size={15} /> Balanced</span>
        </div>
        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Side</th>
                <th className="numeric">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {payment.ledgerLines.map((line) => (
                <tr key={`${line.account}-${line.side}`}>
                  <td>{line.account}</td>
                  <td>{line.side}</td>
                  <td className="numeric">{currency.format(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ledger-balance">
            <div><span>Debits</span><strong>{currency.format(debitTotal)}</strong></div>
            <div><span>Credits</span><strong>{currency.format(creditTotal)}</strong></div>
            <StatusPill tone="success">Balanced</StatusPill>
          </div>
        </div>
      </section>

      {reconciliation ? (
        <section className="evidence-card reconciliation-card" aria-live="polite">
          <div className="evidence-card__heading">
            <h2>Reconciliation run</h2>
            {reconciliation.repaired ? <StatusPill tone="success">Resolved</StatusPill> : <StatusPill tone="warning">Open</StatusPill>}
          </div>
          <dl>
            <KeyValue label="Run"><span className="text-info">{reconciliation.runId}</span></KeyValue>
            <KeyValue label="Mismatch"><span className={reconciliation.repaired ? 'text-success' : 'text-danger'}>{reconciliation.mismatch}</span></KeyValue>
            <KeyValue label="Expected version">{reconciliation.expectedVersion}</KeyValue>
            <KeyValue label="Current version">{reconciliation.currentVersion}</KeyValue>
            <KeyValue label="Repair">{reconciliation.repair}</KeyValue>
            <KeyValue label="Result"><span className="text-success">{reconciliation.result}</span></KeyValue>
          </dl>
          <button
            className="button button--repair"
            type="button"
            onClick={onReconcile}
            disabled={busy || reconciliation.repaired}
          >
            {reconciliation.repaired ? <Check size={18} /> : <RefreshCw size={18} className={busy ? 'spin' : ''} />}
            <span>
              {reconciliation.repaired
                ? 'Safe repair completed'
                : busy
                  ? 'Reconciling…'
                  : 'Run safe reconciliation'}
            </span>
          </button>
          <p className="repair-assurance">
            <CheckCircle2 size={18} />
            {reconciliation.repaired ? 'No duplicate ledger write' : 'Compare-and-swap guarded'}
          </p>
        </section>
      ) : (
        <section className="evidence-card assurance-card">
          <div className="evidence-card__heading">
            <h2>Operational assurance</h2>
            <StatusPill tone="success">Verified</StatusPill>
          </div>
          <div className="assurance-lock"><ShieldCheck size={28} /></div>
          <strong>Exactly-once ledger outcome</strong>
          <p>Idempotency, risk decision, and balanced journal evidence are linked to one immutable audit trail.</p>
        </section>
      )}
    </aside>
  )
}
