import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/AppShell'
import { EvidenceRail } from './components/EvidenceRail'
import { PaymentComposer } from './components/PaymentComposer'
import { PaymentTable } from './components/PaymentTable'
import { RecoveryTimeline } from './components/RecoveryTimeline'
import { ScenarioControls } from './components/ScenarioControls'
import { StatusPill } from './components/StatusPill'
import { api } from './lib/api'
import type { CreatePaymentInput, ScenarioName, ScenarioResult } from './types'

type ActionName = 'initial' | 'scenario' | 'payment' | 'reconciliation' | null

export function App() {
  const [result, setResult] = useState<ScenarioResult | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [action, setAction] = useState<ActionName>('initial')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    api.getPayments()
      .then((data) => {
        if (!active) return
        setResult(data)
        setSelectedId(data.selectedPaymentId)
      })
      .catch(() => {
        if (active) setError('The operations console could not load payment data.')
      })
      .finally(() => {
        if (active) setAction(null)
      })
    return () => {
      active = false
    }
  }, [])

  const selectedPayment = useMemo(
    () => result?.payments.find((payment) => payment.id === selectedId) ?? result?.payments[0],
    [result, selectedId],
  )

  async function execute(actionName: Exclude<ActionName, 'initial' | null>, operation: () => Promise<ScenarioResult>, success: string) {
    setAction(actionName)
    setError('')
    setNotice('')
    try {
      const data = await operation()
      setResult(data)
      setSelectedId(data.selectedPaymentId)
      setNotice(success)
    } catch {
      setError('The operation was not completed. No unsafe state change was applied.')
    } finally {
      setAction(null)
    }
  }

  function runScenario(scenario: ScenarioName) {
    void execute(
      'scenario',
      () => api.runScenario(scenario),
      scenario === 'duplicate'
        ? 'Duplicate replayed safely — one ledger entry remains.'
        : scenario === 'timeout'
          ? 'Timeout reproduced — reconciliation is required.'
          : 'Normal payment completed and balanced.',
    )
  }

  async function createPayment(input: CreatePaymentInput) {
    await execute('payment', () => api.createPayment(input), 'Payment approved and ledger balanced.')
  }

  function reconcile() {
    void execute(
      'reconciliation',
      () => api.reconcile(),
      'Safe repair completed — no duplicate ledger write.',
    )
  }

  if (action === 'initial' && !result) {
    return (
      <div className="splash-screen">
        <img src="/assets/clearledger-mark.png" alt="" />
        <span className="splash-screen__brand">ClearLedger</span>
        <span>Opening payment operations…</span>
      </div>
    )
  }

  if (!result || !selectedPayment) {
    return (
      <div className="fatal-state" role="alert">
        <AlertCircle size={30} />
        <h1>Payment operations unavailable</h1>
        <p>{error || 'No payment data was returned.'}</p>
        <button type="button" className="button button--primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  const isBusy = action !== null
  const primaryTone = selectedPayment.statusTone === 'danger'
    ? 'danger'
    : result.scenario === 'timeout' && !result.reconciliation?.repaired
      ? 'warning'
      : 'success'

  return (
    <AppShell>
      <div className="operations-toolbar">
        <PaymentComposer busy={isBusy} onSubmit={createPayment} />
        <ScenarioControls active={result.scenario} busy={isBusy} onRun={runScenario} />
      </div>

      <div className="dashboard-grid">
        <section className="recovery-workspace" aria-labelledby="payment-heading">
          <header className="payment-heading">
            <div>
              <h1 id="payment-heading">{result.heading}</h1>
              <p>{result.summary}</p>
              <div className="payment-identifiers">
                <code>{selectedPayment.id}</code>
                <StatusPill tone={primaryTone}>
                  {selectedPayment.status === 'Unknown' ? 'Status unknown' : selectedPayment.status}
                </StatusPill>
                {result.reconciliation && !result.reconciliation.repaired ? (
                  <StatusPill tone="warning">Reconciliation open</StatusPill>
                ) : null}
              </div>
            </div>
            <dl className="payment-meta">
              <div><dt>Idempotency key</dt><dd>{selectedPayment.idempotencyKey}</dd></div>
              <div><dt>Version</dt><dd>v{selectedPayment.version}</dd></div>
            </dl>
          </header>

          <RecoveryTimeline events={selectedPayment.audit} />
          <PaymentTable
            payments={result.payments}
            selectedId={selectedPayment.id}
            onSelect={setSelectedId}
          />
        </section>

        <EvidenceRail
          payment={selectedPayment}
          reconciliation={result.reconciliation}
          busy={action === 'reconciliation'}
          onReconcile={reconcile}
        />
      </div>

      {notice ? (
        <div className="toast toast--success" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="toast toast--danger" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      ) : null}
    </AppShell>
  )
}
