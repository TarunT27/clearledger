import { CheckCircle2, Clock3, Copy } from 'lucide-react'
import type { ScenarioName } from '../types'

const scenarios = [
  { id: 'normal', label: 'Normal', icon: CheckCircle2 },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'timeout', label: 'Timeout', icon: Clock3 },
] as const

export function ScenarioControls({
  active,
  busy,
  onRun,
}: {
  readonly active: ScenarioName
  readonly busy: boolean
  readonly onRun: (scenario: ScenarioName) => void
}) {
  return (
    <section className="scenario-controls" aria-label="Demo scenarios">
      {scenarios.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`scenario-button scenario-button--${id}${active === id ? ' is-active' : ''}`}
          aria-pressed={active === id}
          disabled={busy}
          onClick={() => onRun(id)}
        >
          <Icon size={20} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </section>
  )
}
