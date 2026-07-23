import { AlertTriangle, Check, Circle, Clock3 } from 'lucide-react'
import type { AuditEvent } from '../types'

function TimelineMarker({ state }: { readonly state: AuditEvent['state'] }) {
  if (state === 'complete') return <Check size={19} aria-hidden="true" />
  if (state === 'warning') return <AlertTriangle size={20} aria-hidden="true" />
  return <Clock3 size={19} aria-hidden="true" />
}

export function RecoveryTimeline({ events }: { readonly events: readonly AuditEvent[] }) {
  return (
    <section className="recovery-timeline" aria-labelledby="audit-timeline-title">
      <h2 className="sr-only" id="audit-timeline-title">Payment audit timeline</h2>
      <ol>
        {events.map((event, index) => (
          <li key={event.id} className={`timeline-event timeline-event--${event.state}`}>
            <span className="timeline-event__line" aria-hidden="true" />
            <span className="timeline-event__marker">
              <TimelineMarker state={event.state} />
            </span>
            <div className="timeline-event__copy">
              <strong>{event.label}</strong>
              <span className="timeline-event__detail">{event.detail}</span>
              <time>
                <span>{event.timestamp === '—' ? '—' : event.timestamp}</span>
                <span>{event.timestamp === '—' ? 'Pending' : BASE_DATE}</span>
              </time>
            </div>
            {index === events.length - 1 ? <Circle className="sr-only" /> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

const BASE_DATE = 'May 16, 2025'
