import { CheckCircle2, Copy, FlaskConical, Play, Repeat, Timer } from 'lucide-react'
import { useState } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { ScenarioResult } from '../lib/consoleTypes'
import { PageHeader, Spinner, TonePill } from '../components/primitives'
import type { ViewId } from '../components/AppShell'

type ScenarioName = 'normal' | 'duplicate' | 'timeout'

interface ScenarioDefinition {
  readonly id: ScenarioName
  readonly title: string
  readonly icon: typeof Play
  readonly question: string
  readonly guarantee: string
  readonly watch: string
}

const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: 'normal',
    title: 'Normal payment',
    icon: Play,
    question: 'What does the happy path actually do?',
    guarantee:
      'Risk is assessed, a balanced debit and credit are journaled, and the status is finalized from the recorded decision.',
    watch: 'One payment, one journal, equal debits and credits, a final status.',
  },
  {
    id: 'duplicate',
    title: 'Duplicate request',
    icon: Repeat,
    question: 'What happens when a client retries with the same idempotency key?',
    guarantee:
      'The second request matches the stored request fingerprint and returns the original payment. No second journal is written.',
    watch: 'Two requests, one payment, one journal. The replay is flagged as a duplicate.',
  },
  {
    id: 'timeout',
    title: 'Timeout after commit',
    icon: Timer,
    question: 'What if the journal commits but the caller never learns the outcome?',
    guarantee:
      'The payment stays PENDING with its journal already posted. Reconciliation verifies that journal and compare-and-swaps the status — it never re-posts money.',
    watch: 'Status pending, journal balanced. Then repair it from the reconciliation workbench.',
  },
]

export interface ScenarioLabPageProps {
  readonly onNavigate: (view: ViewId) => void
  readonly onToast: (message: string, tone: 'success' | 'error') => void
  readonly onChanged: () => void
}

/**
 * Three deterministic demonstrations of the engine's safety properties.
 *
 * Each one runs against the live API and writes real rows: the timeout scenario genuinely
 * leaves an unfinished payment behind, which is why the reconciliation workbench has
 * something to repair afterwards.
 */
export function ScenarioLabPage({ onNavigate, onToast, onChanged }: ScenarioLabPageProps) {
  const [running, setRunning] = useState<ScenarioName | null>(null)
  const [results, setResults] = useState<Partial<Record<ScenarioName, ScenarioResult>>>({})

  async function run(scenario: ScenarioName) {
    setRunning(scenario)
    try {
      const result = await consoleApi.runScenario(scenario)
      setResults((current) => ({ ...current, [scenario]: result }))
      onToast(result.narrative, 'success')
      onChanged()
    } catch (cause) {
      onToast(
        cause instanceof Error ? cause.message : 'The scenario could not be run.',
        'error',
      )
    } finally {
      setRunning(null)
    }
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Safety properties"
        title="Scenario lab"
        lede="Three demonstrations that run against the live API and leave real rows behind, isolated from the operations dataset."
      />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon
          const result = results[scenario.id]
          return (
            <section key={scenario.id} className="card">
              <div className="card__header">
                <div className="stack stack--tight">
                  <span className="row">
                    <span className="avatar" aria-hidden="true">
                      <Icon size={14} />
                    </span>
                    <h2 className="card__title">{scenario.title}</h2>
                  </span>
                  <p className="card__subtitle">{scenario.question}</p>
                </div>
              </div>
              <div className="card__body stack">
                <p className="text-footnote text-secondary">{scenario.guarantee}</p>
                <div
                  className="stack stack--tight"
                  style={{
                    padding: 'var(--space-3)',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span className="eyebrow">What to watch</span>
                  <span className="text-footnote">{scenario.watch}</span>
                </div>

                {result ? (
                  <div className="stack stack--tight">
                    <span className="eyebrow">Last run</span>
                    <p className="text-footnote">{result.narrative}</p>
                    <ol className="timeline">
                      {result.timeline.map((step) => (
                        <li key={step} className="timeline__item">
                          <span className="timeline__dot" data-tone="success">
                            <CheckCircle2 size={11} aria-hidden="true" />
                          </span>
                          <span className="timeline__title">{step}</span>
                        </li>
                      ))}
                    </ol>
                    {result.duplicateDetected ? (
                      <TonePill tone="info">
                        <Copy size={12} aria-hidden="true" /> Duplicate detected
                      </TonePill>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="card__footer">
                {running === scenario.id ? <Spinner label="Running…" /> : <span />}
                <span className="row">
                  {scenario.id === 'timeout' && result ? (
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => onNavigate('reconciliation')}
                    >
                      Go repair it
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={running !== null}
                    onClick={() => run(scenario.id)}
                  >
                    <FlaskConical size={14} aria-hidden="true" />
                    Run
                  </button>
                </span>
              </div>
            </section>
          )
        })}
      </div>

      <section className="card">
        <div className="card__header">
          <div>
            <div className="eyebrow">Why these three</div>
            <h2 className="card__title">The properties being demonstrated</h2>
          </div>
        </div>
        <div className="card__body">
          <dl className="datalist">
            <dt>At most one payment</dt>
            <dd>A sender and hashed idempotency key identify at most one payment.</dd>
            <dt>No plaintext keys</dt>
            <dd>An idempotency key is never persisted in plaintext.</dd>
            <dt>Conflict, not replay</dt>
            <dd>The same key with a different request fingerprint is rejected as a conflict.</dd>
            <dt>One journal per payment</dt>
            <dd>A journal belongs to exactly one payment and always balances in one currency.</dd>
            <dt>Explicit transitions</dt>
            <dd>Status moves only through the state machine, never by assignment.</dd>
            <dt>Verify, never retry</dt>
            <dd>
              Reconciliation reads the committed journal and updates the still-pending row only
              if its expected version still matches.
            </dd>
          </dl>
        </div>
      </section>
    </main>
  )
}
