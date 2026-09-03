import { FileText, Lock } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { AuditEventView } from '../lib/consoleTypes'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatFullTimestamp } from '../lib/format'
import { useDebounced, useResource } from '../hooks/useResource'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Pagination,
  RefreshButton,
  SearchField,
  TonePill,
} from '../components/primitives'

const PAGE_SIZE = 25

const EVENT_TYPES = [
  'PAYMENT_ACCEPTED',
  'JOURNAL_POSTED',
  'PAYMENT_FINALIZED',
  'IDEMPOTENT_REPLAY',
  'RECONCILIATION_REQUIRED',
  'RECONCILIATION_REPAIRED',
  'RECONCILIATION_FINALIZED',
  'RECONCILIATION_FLAGGED',
]

export interface AuditPageProps {
  readonly onSelectPayment: (paymentId: string) => void
  readonly reloadToken: number
}

/**
 * The append-only log.
 *
 * Rows are never edited or deleted anywhere in the system, so this page has no actions on
 * it beyond reading and exporting — which is the point of an audit trail.
 */
export function AuditPage({ onSelectPayment, reloadToken }: AuditPageProps) {
  const [query, setQuery] = useState('')
  const [eventType, setEventType] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebounced(query)

  useEffect(() => setPage(0), [debounced, eventType])

  const load = useCallback(
    (signal: AbortSignal) =>
      consoleApi.auditEvents(debounced, eventType, page, PAGE_SIZE, signal),
    [debounced, eventType, page],
  )
  const { data, error, loading, refreshing, reload } = useResource(load, [
    debounced,
    eventType,
    page,
    reloadToken,
  ])

  function exportCsv(rows: readonly AuditEventView[]) {
    downloadCsv(
      `clearledger-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['Recorded', 'Event', 'Actor', 'Payment', 'Detail'],
        rows.map((event) => [
          event.createdAt,
          event.eventType,
          event.actor,
          event.paymentReference,
          event.detail,
        ]),
      ),
    )
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Assurance"
        title="Audit log"
        lede="Append-only events written by the payment path, the ledger, and the reconciler."
        tools={
          <>
            <RefreshButton onClick={reload} busy={refreshing} />
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!data || data.items.length === 0}
              onClick={() => data && exportCsv(data.items)}
            >
              Export CSV
            </button>
          </>
        }
      />

      <section className="card">
        <div className="card__body row row--wrap" style={{ padding: 'var(--space-4)' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search audit events"
              placeholder="Detail, actor, or event type…"
            />
          </div>
          <select
            className="select"
            style={{ width: 'auto' }}
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            aria-label="Filter by event type"
          >
            <option value="">All events</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <span className="row text-caption text-tertiary">
            <Lock size={12} aria-hidden="true" />
            Read-only by design
          </span>
        </div>
      </section>

      <section className="card card--flush">
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingRows rows={9} height={38} /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState
            title="No events match"
            body="Every state change writes an event here. Try clearing the filters."
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="table table--interactive">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Payment</th>
                    <th>Detail</th>
                    <th>Actor</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event) => (
                    <tr
                      key={event.id}
                      tabIndex={0}
                      onClick={() => event.paymentId && onSelectPayment(event.paymentId)}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === 'Enter' && event.paymentId) {
                          onSelectPayment(event.paymentId)
                        }
                      }}
                    >
                      <td>
                        <span className="row">
                          <span className="timeline__dot" data-tone={event.tone}>
                            <FileText size={10} aria-hidden="true" />
                          </span>
                          {event.label}
                        </span>
                      </td>
                      <td>
                        <span className="mono text-secondary">
                          {event.paymentReference ?? '—'}
                        </span>
                      </td>
                      <td className="text-secondary">{event.detail}</td>
                      <td>
                        <TonePill tone="neutral">{event.actor.toLowerCase()}</TonePill>
                      </td>
                      <td className="text-secondary">{formatFullTimestamp(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card__footer">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                totalItems={data.totalItems}
                onChange={setPage}
                noun="event"
              />
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
