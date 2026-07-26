import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  OperationsFixture,
  ReconciliationCaseRecord,
  ReconciliationSeverity,
} from '../lib/operationsData'
import '../styles/operationsPages.css'

export interface ReconciliationPageProps {
  readonly fixture: OperationsFixture
  readonly onRepair: (caseId: string) => void | Promise<void>
  readonly onSelectPayment: (paymentId: string) => void
}

type CaseFilter = 'all' | 'open' | 'repaired'

interface RunResult {
  readonly runs: number
  readonly scanned: number
  readonly exceptions: number
  readonly repaired: number
}

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date)
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function severityTone(severity: ReconciliationSeverity): 'danger' | 'warning' | 'info' | 'neutral' {
  if (severity === 'Critical') return 'danger'
  if (severity === 'High' || severity === 'Medium') return 'warning'
  if (severity === 'Low') return 'info'
  return 'neutral'
}

function caseNeedsRepair(
  item: ReconciliationCaseRecord,
  locallyRepaired: ReadonlySet<string>,
): boolean {
  return item.state !== 'Repaired' && !locallyRepaired.has(item.id)
}

export function ReconciliationPage({
  fixture,
  onRepair,
  onSelectPayment,
}: ReconciliationPageProps) {
  const firstOpenCase = fixture.reconciliationCases.find((item) => item.state !== 'Repaired')
  const [filter, setFilter] = useState<CaseFilter>('open')
  const [selectedCaseId, setSelectedCaseId] = useState(
    firstOpenCase?.id ?? fixture.reconciliationCases[0]?.id ?? '',
  )
  const [locallyRepaired, setLocallyRepaired] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [repairingCaseId, setRepairingCaseId] = useState('')
  const [repairError, setRepairError] = useState('')
  const [runResult, setRunResult] = useState<RunResult>({
    runs: 0,
    scanned: 0,
    exceptions: 0,
    repaired: 0,
  })

  const openCount = fixture.reconciliationCases.filter(
    (item) => caseNeedsRepair(item, locallyRepaired),
  ).length
  const repairedCount = fixture.reconciliationCases.length - openCount

  const filteredCases = useMemo(
    () => fixture.reconciliationCases.filter((item) => {
      const needsRepair = caseNeedsRepair(item, locallyRepaired)
      if (filter === 'open') return needsRepair
      if (filter === 'repaired') return !needsRepair
      return true
    }),
    [filter, fixture.reconciliationCases, locallyRepaired],
  )

  const selectedCase = fixture.reconciliationCases.find(
    (item) => item.id === selectedCaseId,
  ) ?? filteredCases[0] ?? fixture.reconciliationCases[0] ?? null
  const selectedPayment = selectedCase
    ? fixture.payments.find((payment) => payment.id === selectedCase.paymentId) ?? null
    : null
  const selectedJournal = selectedCase
    ? fixture.journals.find((journal) => (
      journal.id === selectedCase.journalId || journal.paymentId === selectedCase.paymentId
    )) ?? null
    : null
  const selectedCaseRepaired = selectedCase
    ? !caseNeedsRepair(selectedCase, locallyRepaired)
    : false

  function runReconciliation() {
    setRunResult((previous) => ({
      runs: previous.runs + 1,
      scanned: fixture.payments.length,
      exceptions: openCount,
      repaired: repairedCount,
    }))
  }

  async function approveRepair(item: ReconciliationCaseRecord) {
    setRepairError('')
    setRepairingCaseId(item.id)
    try {
      await onRepair(item.id)
      setLocallyRepaired((current) => new Set([...current, item.id]))
    } catch {
      setRepairError('Repair was not completed. The reconciliation case remains unchanged.')
    } finally {
      setRepairingCaseId('')
    }
  }

  return (
    <div className="operations-page operations-page--reconciliation">
      <header className="operations-page__header">
        <div>
          <span className="operations-eyebrow">Integrity controls</span>
          <h1>Reconciliation</h1>
          <p>Resolve processor and payment-state drift without duplicating ledger writes.</p>
        </div>
        <button type="button" className="operations-primary-button" onClick={runReconciliation}>
          <RefreshCw size={17} aria-hidden="true" />
          Run reconciliation
        </button>
      </header>

      <section className="reconciliation-run" aria-label="Latest reconciliation run" aria-live="polite">
        <div>
          <span>Runs completed</span>
          <strong>{runResult.runs}</strong>
        </div>
        <div>
          <span>Payments checked</span>
          <strong>{runResult.scanned}</strong>
        </div>
        <div>
          <span>Exceptions found</span>
          <strong>{runResult.exceptions}</strong>
        </div>
        <div>
          <span>Repairs completed</span>
          <strong>{runResult.repaired}</strong>
        </div>
        {runResult.runs > 0 ? (
          <p><Check size={15} aria-hidden="true" /> Reconciliation run {runResult.runs} completed</p>
        ) : null}
      </section>

      <div className="reconciliation-workspace">
        <section className="operations-panel exception-queue" aria-labelledby="exception-queue-title">
          <div className="operations-panel__header operations-panel__header--stack">
            <div>
              <span className="operations-eyebrow">Exception queue</span>
              <h2 id="exception-queue-title">State mismatches</h2>
              <p>{openCount} cases still require attention</p>
            </div>
            <div className="operations-tabs" role="tablist" aria-label="Reconciliation filters">
              {([
                ['all', 'All cases', fixture.reconciliationCases.length],
                ['open', 'Needs repair', openCount],
                ['repaired', 'Repaired', repairedCount],
              ] as const).map(([value, label, count]) => (
                <button
                  type="button"
                  role="tab"
                  id={`reconciliation-tab-${value}`}
                  aria-controls="reconciliation-case-panel"
                  aria-selected={filter === value}
                  className={filter === value ? 'is-active' : undefined}
                  onClick={() => setFilter(value)}
                  key={value}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            id="reconciliation-case-panel"
            role="tabpanel"
            aria-labelledby={`reconciliation-tab-${filter}`}
            className="exception-list"
          >
            {filteredCases.map((item) => {
              const isRepaired = !caseNeedsRepair(item, locallyRepaired)
              return (
                <article
                  className={`exception-item${selectedCase?.id === item.id ? ' is-selected' : ''}`}
                  key={item.id}
                >
                  <div className="exception-item__marker" aria-hidden="true">
                    {isRepaired ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
                  </div>
                  <div className="exception-item__body">
                    <div className="exception-item__heading">
                      <div>
                        <code>{item.paymentId}</code>
                        <strong>{item.merchant}</strong>
                      </div>
                      <span className={`operation-badge operation-badge--${isRepaired ? 'success' : severityTone(item.severity)}`}>
                        {isRepaired ? 'Repaired' : item.severity}
                      </span>
                    </div>
                    <p>{item.reason}</p>
                    <div className="exception-item__meta">
                      <span>{item.age}</span>
                      <span>{isRepaired ? 'Resolved' : item.state}</span>
                      <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="operations-secondary-button"
                    aria-label={`Review case ${item.paymentId}`}
                    onClick={() => {
                      setSelectedCaseId(item.id)
                      setRepairError('')
                    }}
                  >
                    Review case
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </article>
              )
            })}

            {filteredCases.length === 0 ? (
              <div className="operations-empty" role="status">
                <CheckCircle2 size={23} aria-hidden="true" />
                <strong>No cases in this view</strong>
                <button
                  type="button"
                  className="operations-text-button"
                  onClick={() => setFilter('all')}
                >
                  Show all cases
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="operations-panel reconciliation-evidence" aria-label="Reconciliation evidence">
          {selectedCase ? (
            <>
              <div className="operations-panel__header">
                <div>
                  <span className="operations-eyebrow">Case evidence</span>
                  <h2>{selectedCase.paymentId}</h2>
                </div>
                <span className={`operation-badge operation-badge--${selectedCaseRepaired ? 'success' : severityTone(selectedCase.severity)}`}>
                  {selectedCaseRepaired ? 'Repaired' : selectedCase.state}
                </span>
              </div>

              <button
                type="button"
                className="reconciliation-payment-link"
                onClick={() => onSelectPayment(selectedCase.paymentId)}
              >
                <span>
                  <small>Payment record</small>
                  <strong>{selectedCase.merchant}</strong>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>

              <section className="evidence-section" aria-labelledby="state-comparison-title">
                <div className="evidence-section__title">
                  <h3 id="state-comparison-title">Expected vs recorded state</h3>
                  <FileCheck2 size={17} aria-hidden="true" />
                </div>
                <div className="state-comparison">
                  <div>
                    <span>Expected state</span>
                    <strong className="text-success">Approved</strong>
                  </div>
                  <ArrowRight size={17} aria-hidden="true" />
                  <div>
                    <span>Recorded state</span>
                    <strong className={selectedCaseRepaired ? 'text-success' : 'text-warning'}>
                      {selectedCaseRepaired ? 'Approved' : selectedPayment?.status ?? 'Unknown'}
                    </strong>
                  </div>
                </div>
                <p className="evidence-reason">{selectedCase.reason}</p>
              </section>

              <section className="evidence-section" aria-labelledby="journal-evidence-title">
                <div className="evidence-section__title">
                  <h3 id="journal-evidence-title">Journal evidence</h3>
                  <span className={`operation-badge operation-badge--${selectedJournal?.balanced ? 'success' : 'warning'}`}>
                    {selectedJournal?.balanced ? 'Balanced' : 'Check journal'}
                  </span>
                </div>
                <dl className="operations-definition-list operations-definition-list--two-column">
                  <div><dt>Journal</dt><dd><code>{selectedJournal?.id ?? selectedCase.journalId}</code></dd></div>
                  <div>
                    <dt>Debit total</dt>
                    <dd>{selectedJournal
                      ? formatMoney(selectedJournal.totalDebits, selectedJournal.currency)
                      : 'Unavailable'}</dd>
                  </div>
                  <div>
                    <dt>Credit total</dt>
                    <dd>{selectedJournal
                      ? formatMoney(selectedJournal.totalCredits, selectedJournal.currency)
                      : 'Unavailable'}</dd>
                  </div>
                  <div><dt>Entries</dt><dd>{selectedJournal?.lines.length ?? 0}</dd></div>
                </dl>
              </section>

              <section className="evidence-section" aria-labelledby="version-check-title">
                <div className="evidence-section__title">
                  <h3 id="version-check-title">Version check</h3>
                  <ShieldCheck size={17} aria-hidden="true" />
                </div>
                <div className="version-check">
                  <div><span>Expected version</span><strong>v{selectedCase.expectedVersion}</strong></div>
                  <ArrowRight size={16} aria-hidden="true" />
                  <div><span>Recorded version</span><strong>v{selectedCase.currentVersion}</strong></div>
                </div>
                <p className="safe-repair-seal">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span><strong>Compare-and-swap guarded</strong> Version is checked again at write time.</span>
                </p>
              </section>

              <section className="repair-plan" aria-live="polite">
                {selectedCaseRepaired ? (
                  <div className="repair-complete">
                    <CheckCircle2 size={25} aria-hidden="true" />
                    <div>
                      <strong>Repair completed</strong>
                      <span>No new ledger entries created</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>Safe repair plan</h3>
                    <p>
                      This action will reuse existing balanced journal{' '}
                      <code>{selectedJournal?.id ?? selectedCase.journalId}</code> and update only
                      the recorded payment state.
                    </p>
                    <small>{selectedCase.repairStrategy}</small>
                    <button
                      type="button"
                      className="operations-primary-button operations-primary-button--full"
                      disabled={repairingCaseId === selectedCase.id}
                      onClick={() => void approveRepair(selectedCase)}
                    >
                      {repairingCaseId === selectedCase.id
                        ? <RefreshCw size={17} className="spin" aria-hidden="true" />
                        : <ShieldCheck size={17} aria-hidden="true" />}
                      {repairingCaseId === selectedCase.id ? 'Applying safe repair…' : 'Approve safe repair'}
                    </button>
                  </>
                )}
                {repairError ? <p className="operations-error" role="alert">{repairError}</p> : null}
              </section>
            </>
          ) : (
            <div className="operations-empty" role="status">
              <CheckCircle2 size={23} aria-hidden="true" />
              <strong>No reconciliation evidence available</strong>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
