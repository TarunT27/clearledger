import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Search,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AuditEventRecord, OperationsFixture } from '../lib/operationsData'
import '../styles/operationsPages.css'

export interface AuditPageProps {
  readonly fixture: OperationsFixture
  readonly onSelectPayment: (paymentId: string) => void
}

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date)
}

function eventTone(state: AuditEventRecord['state']): 'success' | 'warning' | 'neutral' {
  if (state === 'complete') return 'success'
  if (state === 'warning') return 'warning'
  return 'neutral'
}

export function AuditPage({ fixture, onSelectPayment }: AuditPageProps) {
  const [query, setQuery] = useState('')
  const [actorFilter, setActorFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const actors = useMemo(
    () => [...new Set(fixture.auditEvents.map((event) => event.actor))].sort(),
    [fixture.auditEvents],
  )
  const eventTypes = useMemo(
    () => [...new Set(fixture.auditEvents.map((event) => event.label))].sort(),
    [fixture.auditEvents],
  )

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return [...fixture.auditEvents]
      .filter((event) => {
        const matchesActor = actorFilter === 'all' || event.actor === actorFilter
        const matchesType = typeFilter === 'all' || event.label === typeFilter
        const searchable = [
          event.id,
          event.paymentId,
          event.label,
          event.detail,
          event.actor,
          event.timestamp,
        ].join(' ').toLocaleLowerCase()
        return matchesActor && matchesType && (!normalizedQuery || searchable.includes(normalizedQuery))
      })
      .sort((left, right) => (
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      ))
  }, [actorFilter, fixture.auditEvents, query, typeFilter])

  const filtersActive = Boolean(query || actorFilter !== 'all' || typeFilter !== 'all')

  function resetFilters() {
    setQuery('')
    setActorFilter('all')
    setTypeFilter('all')
  }

  return (
    <div className="operations-page operations-page--audit">
      <header className="operations-page__header">
        <div>
          <span className="operations-eyebrow">Immutable evidence</span>
          <h1>Audit log</h1>
          <p>Search the complete operator and system event stream for every payment.</p>
        </div>
        <div className="operations-page__summary">
          <FileSearch size={19} aria-hidden="true" />
          <span>
            <strong>{fixture.auditEvents.length}</strong>
            recorded events
          </span>
        </div>
      </header>

      <section className="operations-panel audit-stream" aria-labelledby="audit-stream-title">
        <div className="operations-panel__header operations-panel__header--toolbar audit-toolbar">
          <div>
            <span className="operations-eyebrow">Event stream</span>
            <h2 id="audit-stream-title">Operational activity</h2>
            <p>{filteredEvents.length} events shown</p>
          </div>
          <div className="audit-filters">
            <label className="operations-search operations-search--wide">
              <span className="sr-only">Search audit events</span>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search payment, actor, event…"
              />
            </label>
            <label className="operations-select">
              <span>Actor</span>
              <select
                aria-label="Audit actor"
                value={actorFilter}
                onChange={(event) => setActorFilter(event.target.value)}
              >
                <option value="all">All actors</option>
                {actors.map((actor) => <option value={actor} key={actor}>{actor}</option>)}
              </select>
            </label>
            <label className="operations-select">
              <span>Event type</span>
              <select
                aria-label="Audit event type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="all">All types</option>
                {eventTypes.map((type) => <option value={type} key={type}>{type}</option>)}
              </select>
            </label>
            {filtersActive ? (
              <button type="button" className="operations-text-button" onClick={resetFilters}>
                Reset filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="operations-table-scroll audit-table-scroll">
          <table className="operations-table audit-table" aria-label="Audit event stream">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Actor</th>
                <th>Payment</th>
                <th>Event</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className="audit-time">
                      <Clock3 size={14} aria-hidden="true" />
                      <time dateTime={event.timestamp}>{formatDate(event.timestamp)}</time>
                    </span>
                  </td>
                  <td><strong className="table-primary">{event.label}</strong></td>
                  <td>
                    <span className="audit-actor">
                      <UserRound size={14} aria-hidden="true" />
                      {event.actor}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="operations-link operations-link--mono"
                      aria-label={`Open payment ${event.paymentId}`}
                      onClick={() => onSelectPayment(event.paymentId)}
                    >
                      {event.paymentId}
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </button>
                  </td>
                  <td>
                    <strong className="table-primary">{event.detail}</strong>
                    <small className="table-secondary">{event.id}</small>
                  </td>
                  <td>
                    <span className={`operation-badge operation-badge--${eventTone(event.state)}`}>
                      {event.state}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="operations-empty" role="status">
            <FileSearch size={23} aria-hidden="true" />
            <strong>No audit events match these filters</strong>
            <button type="button" className="operations-text-button" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        ) : null}

        <footer className="audit-stream__footer">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>Event records are append-only and retained for compliance review.</span>
          <time dateTime={fixture.generatedAt}>Snapshot {formatDate(fixture.generatedAt)}</time>
        </footer>
      </section>
    </div>
  )
}
