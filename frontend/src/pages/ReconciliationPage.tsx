import { CheckCircle2, FileText, Pause, Play, ShieldCheck, Wrench } from 'lucide-react'
import { useCallback, useState } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { ReconciliationCase } from '../lib/consoleTypes'
import { formatCount, formatDateTime, formatDuration, formatMoney, formatRelative } from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Money,
  PageHeader,
  RefreshButton,
  SeverityPill,
  Spinner,
  TonePill,
} from '../components/primitives'
import type { ViewId } from '../components/AppShell'

const ACTION_LABEL: Record<string, string> = {
  FINALIZE_APPROVED: 'Finalize approved',
  FINALIZE_DECISION: 'Apply risk decision',
  FLAG_MANUAL_REVIEW: 'Route to review',
  NO_OP: 'No action',
}

export interface ReconciliationPageProps {
  readonly onSelectPayment: (paymentId: string) => void
  readonly onNavigate: (view: ViewId) => void
  readonly onToast: (message: string, tone: 'success' | 'error') => void
  readonly onChanged: () => void
  readonly reloadToken: number
}

/**
 * The recovery workbench.
 *
 * A repair here is not a retry. The server re-reads the row under a lock, verifies the
 * journal that already committed, and writes only if the version it observed is still the
 * current one — so the outcome panel reports the versions involved, which is the part that
 * proves a stale worker could not have overwritten newer state.
 */
export function ReconciliationPage({
  onSelectPayment,
  onNavigate,
  onToast,
  onChanged,
  reloadToken,
}: ReconciliationPageProps) {
  const load = useCallback((signal: AbortSignal) => consoleApi.reconciliation(signal), [])
  const { data, error, loading, refreshing, reload } = useResource(load, [reloadToken], {
    pollMs: 20_000,
  })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [sweeping, setSweeping] = useState(false)

  async function repair(item: ReconciliationCase) {
    setBusyId(item.paymentId)
    try {
      const outcome = await consoleApi.repair(item.paymentId)
      onToast(
        outcome.alreadyResolved
          ? `${item.reference}: ${outcome.narrative}`
          : `${item.reference} repaired — version ${outcome.observedVersion} → ${outcome.committedVersion}, now ${outcome.status.toLowerCase()}.`,
        'success',
      )
      reload()
      onChanged()
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : 'The repair failed.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function sweep() {
    setSweeping(true)
    try {
      await consoleApi.runReconciliation()
      onToast('Reconciliation sweep completed.', 'success')
      reload()
      onChanged()
    } catch (cause) {
      onToast(cause instanceof Error ? cause.message : 'The sweep failed.', 'error')
    } finally {
      setSweeping(false)
    }
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Recovery"
        title="Reconciliation"
        lede="Pending payments whose ledger evidence has already committed, and the compare-and-swap repair that finishes them safely."
        tools={
          <>
            <RefreshButton onClick={reload} busy={refreshing} />
            <button
              type="button"
              className="btn btn--primary"
              onClick={sweep}
              disabled={sweeping}
            >
              <Wrench size={14} aria-hidden="true" />
              {sweeping ? 'Running…' : 'Run sweep'}
            </button>
          </>
        }
      />

      {error && !data ? (
        <div className="card">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : null}
      {loading && !data ? <LoadingRows rows={4} height={90} /> : null}

      {data ? (
        <>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
          >
            <StatTile label="Open cases" value={formatCount(data.stats.openCases)} caption="pending payments" />
            <StatTile
              label="Ledger already posted"
              value={formatCount(data.stats.journalBackedCases)}
              caption="money moved, status did not"
            />
            <StatTile
              label="Repairable now"
              value={formatCount(data.stats.repairableNow)}
              caption="planner would finalize"
            />
            <StatTile
              label="Repaired to date"
              value={formatCount(data.stats.repairedAllTime)}
              caption={`${formatCount(data.stats.flaggedAllTime)} routed to review`}
            />
          </div>

          <section className="card">
            <div className="card__body row row--between" style={{ padding: 'var(--space-4)' }}>
              <span className="row">
                {data.stats.workerEnabled ? (
                  <TonePill tone="success">
                    <Play size={12} aria-hidden="true" /> Worker running
                  </TonePill>
                ) : (
                  <TonePill tone="warning">
                    <Pause size={12} aria-hidden="true" /> Worker paused
                  </TonePill>
                )}
                <span className="text-footnote text-secondary">
                  {data.stats.workerEnabled
                    ? `Sweeps every ${formatDuration(data.stats.workerIntervalMs / 1000)}. Repairs below do exactly what it does.`
                    : 'Paused in this environment so the queue stays open for you to drive. The repair path is identical either way.'}
                </span>
              </span>
              <span className="text-footnote text-tertiary">
                Last run {formatRelative(data.stats.lastRunAt)}
              </span>
            </div>
          </section>

          <section className="card card--flush">
            <div className="card__header">
              <div>
                <div className="eyebrow">Open exceptions</div>
                <h2 className="card__title">Cases</h2>
                <p className="card__subtitle">
                  Derived on read from the payment, its journal, and its audit trail — never
                  from a stored case row that could drift.
                </p>
              </div>
            </div>

            {data.cases.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={20} aria-hidden="true" />}
                title="Nothing to recover"
                body="Every payment has a final status and every journal balances. Run the timeout scenario to create a real exception and watch the repair."
                action={
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => onNavigate('scenario-lab')}
                  >
                    Open scenario lab
                  </button>
                }
              />
            ) : (
              <div className="stack" style={{ padding: 'var(--space-4)' }}>
                {data.cases.map((item) => (
                  <article
                    key={item.paymentId}
                    className="card"
                    style={{ boxShadow: 'none', background: 'var(--surface-sunken)' }}
                  >
                    <div className="card__header">
                      <div className="stack stack--tight" style={{ minWidth: 0 }}>
                        <div className="row">
                          <SeverityPill severity={item.severity} />
                          <button
                            type="button"
                            className="btn btn--quiet mono"
                            onClick={() => onSelectPayment(item.paymentId)}
                          >
                            {item.reference}
                          </button>
                          <span className="text-caption text-tertiary">
                            open {formatDuration(item.ageSeconds)}
                          </span>
                        </div>
                        <span className="text-footnote text-secondary">{item.reason}</span>
                      </div>
                      <div className="stack stack--tight" style={{ textAlign: 'right' }}>
                        <Money amountMinor={item.amountMinor} currency={item.currency} />
                        <span className="text-caption text-tertiary">
                          {item.recipient.displayName}
                        </span>
                      </div>
                    </div>

                    <div className="card__body">
                      <div
                        className="grid"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
                      >
                        <div className="stack stack--tight">
                          <span className="eyebrow">Ledger evidence</span>
                          {item.journal ? (
                            <dl className="datalist">
                              <dt>Journal</dt>
                              <dd className="mono">{item.journal.reference}</dd>
                              <dt>Debits</dt>
                              <dd>
                                {formatMoney(item.journal.totalDebitsMinor, item.journal.currency)}
                              </dd>
                              <dt>Credits</dt>
                              <dd>
                                {formatMoney(item.journal.totalCreditsMinor, item.journal.currency)}
                              </dd>
                              <dt>Verified</dt>
                              <dd>
                                <span className="row">
                                  {item.balanced ? (
                                    <TonePill tone="success">Balanced</TonePill>
                                  ) : (
                                    <TonePill tone="danger">Unbalanced</TonePill>
                                  )}
                                  {item.matchesPayment ? (
                                    <TonePill tone="success">Matches</TonePill>
                                  ) : (
                                    <TonePill tone="danger">Mismatch</TonePill>
                                  )}
                                </span>
                              </dd>
                            </dl>
                          ) : (
                            <p className="text-footnote text-secondary">
                              No journal exists for this payment, so no money was posted.
                            </p>
                          )}
                        </div>

                        <div className="stack stack--tight">
                          <span className="eyebrow">Planned repair</span>
                          <div className="row">
                            <TonePill tone="info">
                              {ACTION_LABEL[item.plannedAction] ?? item.plannedAction}
                            </TonePill>
                            <span className="text-caption text-tertiary tnum">
                              expects version {item.version}
                            </span>
                          </div>
                          <p className="text-footnote text-secondary">{item.repairStrategy}</p>
                        </div>

                        <div className="stack stack--tight">
                          <span className="eyebrow">Trail</span>
                          <ol className="timeline">
                            {item.evidence.slice(-3).map((event) => (
                              <li key={event.id} className="timeline__item">
                                <span className="timeline__dot" data-tone={event.tone}>
                                  <FileText size={10} aria-hidden="true" />
                                </span>
                                <div className="stack stack--tight">
                                  <span className="timeline__title">{event.label}</span>
                                  <span className="timeline__time">
                                    {formatDateTime(event.createdAt)}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </div>

                    <div className="card__footer">
                      <span>Detected {formatDateTime(item.detectedAt)}</span>
                      <span className="row">
                        {busyId === item.paymentId ? <Spinner label="Repairing…" /> : null}
                        <button
                          type="button"
                          className="btn btn--secondary"
                          onClick={() => onSelectPayment(item.paymentId)}
                        >
                          Open evidence
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={busyId !== null}
                          onClick={() => repair(item)}
                        >
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Repair safely
                        </button>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card card--flush">
            <div className="card__header">
              <div>
                <div className="eyebrow">History</div>
                <h2 className="card__title">Reconciliation runs</h2>
              </div>
            </div>
            {data.runs.length === 0 ? (
              <EmptyState
                title="No runs recorded"
                body="Reconciliation has not run in this database yet. Start a sweep above to record one."
              />
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Started</th>
                      <th>Trigger</th>
                      <th className="numeric">Scanned</th>
                      <th className="numeric">Repaired</th>
                      <th className="numeric">Flagged</th>
                      <th className="numeric">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.runs.map((run) => (
                      <tr key={run.id}>
                        <td className="text-secondary">{formatDateTime(run.startedAt)}</td>
                        <td>
                          <TonePill tone={run.trigger === 'SCHEDULED' ? 'neutral' : 'info'}>
                            {run.trigger.toLowerCase()}
                          </TonePill>
                        </td>
                        <td className="numeric">{run.scanned}</td>
                        <td className="numeric">{run.repaired}</td>
                        <td className="numeric">{run.flagged}</td>
                        <td className="numeric text-secondary">
                          {Math.max(
                            0,
                            new Date(run.completedAt).getTime() -
                              new Date(run.startedAt).getTime(),
                          )}
                          &nbsp;ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}

function StatTile({
  label,
  value,
  caption,
}: {
  readonly label: string
  readonly value: string
  readonly caption: string
}) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <span className="metric__value">{value}</span>
      <span className="metric__foot">{caption}</span>
    </div>
  )
}
