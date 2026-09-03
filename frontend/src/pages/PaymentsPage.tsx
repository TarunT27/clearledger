import { ArrowDown, ArrowUp, Download, Plus, SlidersHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { PaymentRow, PaymentStatus, RiskDecision } from '../lib/consoleTypes'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatDateTime } from '../lib/format'
import { useDebounced, useResource } from '../hooks/useResource'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  Money,
  PageHeader,
  Pagination,
  Party,
  RefreshButton,
  SearchField,
  StatusPill,
  TonePill,
} from '../components/primitives'

const PAGE_SIZE = 20

const SORTABLE: ReadonlyArray<{ readonly key: string; readonly label: string; readonly numeric?: boolean }> = [
  { key: 'reference', label: 'Payment' },
  { key: 'amountMinor', label: 'Amount', numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'riskScore', label: 'Risk', numeric: true },
  { key: 'createdAt', label: 'Created' },
]

export interface PaymentsPageProps {
  readonly initialQuery: string
  readonly onSelectPayment: (paymentId: string) => void
  readonly onCompose: () => void
  readonly reloadToken: number
}

export function PaymentsPage({
  initialQuery,
  onSelectPayment,
  onCompose,
  reloadToken,
}: PaymentsPageProps) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<PaymentStatus | ''>('')
  const [risk, setRisk] = useState<RiskDecision | ''>('')
  const [signal, setSignal] = useState('')
  const [sort, setSort] = useState('createdAt')
  const [direction, setDirection] = useState<'ASC' | 'DESC'>('DESC')
  const [page, setPage] = useState(0)

  useEffect(() => {
    setQuery(initialQuery)
    setPage(0)
  }, [initialQuery])

  const debouncedQuery = useDebounced(query)

  useEffect(() => {
    setPage(0)
  }, [debouncedQuery, status, risk, signal, sort, direction])

  const load = useCallback(
    (abort: AbortSignal) =>
      consoleApi.payments(
        {
          query: debouncedQuery || undefined,
          status: status || undefined,
          risk: risk || undefined,
          signal: signal || undefined,
          sort,
          direction,
          page,
          size: PAGE_SIZE,
        },
        abort,
      ),
    [debouncedQuery, status, risk, signal, sort, direction, page],
  )

  const { data, error, loading, refreshing, reload } = useResource(load, [
    debouncedQuery,
    status,
    risk,
    signal,
    sort,
    direction,
    page,
    reloadToken,
  ])

  const filtered = useMemo(
    () => Boolean(debouncedQuery || status || risk || signal),
    [debouncedQuery, status, risk, signal],
  )

  function toggleSort(key: string) {
    if (sort === key) {
      setDirection((current) => (current === 'ASC' ? 'DESC' : 'ASC'))
      return
    }
    setSort(key)
    setDirection(key === 'createdAt' || key === 'amountMinor' || key === 'riskScore' ? 'DESC' : 'ASC')
  }

  function exportCsv(rows: readonly PaymentRow[]) {
    downloadCsv(
      `clearledger-payments-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        [
          'Reference',
          'Payment ID',
          'Sender',
          'Recipient',
          'Amount',
          'Currency',
          'Status',
          'Risk decision',
          'Risk score',
          'Risk signals',
          'Journal posted',
          'Created',
        ],
        rows.map((row) => [
          row.reference,
          row.id,
          row.sender.displayName,
          row.recipient.displayName,
          (row.amountMinor / 100).toFixed(2),
          row.currency,
          row.status,
          row.riskDecision,
          row.riskScore,
          row.riskSignals.join(' '),
          row.journalPosted ? 'yes' : 'no',
          row.createdAt,
        ]),
      ),
    )
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Records"
        title="Payments"
        lede="Every payment the engine has accepted, filtered and sorted by the database rather than the browser."
        tools={
          <>
            <RefreshButton onClick={reload} busy={refreshing} />
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!data || data.items.length === 0}
              onClick={() => data && exportCsv(data.items)}
            >
              <Download size={14} aria-hidden="true" />
              Export CSV
            </button>
            <button type="button" className="btn btn--primary" onClick={onCompose}>
              <Plus size={15} aria-hidden="true" />
              New payment
            </button>
          </>
        }
      />

      <section className="card">
        <div className="card__body" style={{ padding: 'var(--space-4)' }}>
          <div className="row row--wrap">
            <SlidersHorizontal size={15} className="text-tertiary" aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 220 }}>
              <SearchField
                value={query}
                onChange={setQuery}
                label="Filter payments"
                placeholder="Reference, description, counterparty, currency…"
              />
            </div>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={status}
              onChange={(event) => setStatus(event.target.value as PaymentStatus | '')}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="REVIEW">Review</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending</option>
            </select>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={risk}
              onChange={(event) => setRisk(event.target.value as RiskDecision | '')}
              aria-label="Filter by risk decision"
            >
              <option value="">All decisions</option>
              <option value="APPROVED">Risk approved</option>
              <option value="REVIEW">Risk review</option>
              <option value="REJECTED">Risk rejected</option>
            </select>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={signal}
              onChange={(event) => setSignal(event.target.value)}
              aria-label="Filter by risk signal"
            >
              <option value="">Any signal</option>
              <option value="UNUSUAL_AMOUNT">Unusual amount</option>
              <option value="REPEATED_ATTEMPTS">Repeated attempts</option>
              <option value="NEW_RECIPIENT">New recipient</option>
              <option value="VELOCITY_LIMIT">Velocity limit</option>
            </select>
            {filtered ? (
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  setQuery('')
                  setStatus('')
                  setRisk('')
                  setSignal('')
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card card--flush">
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingRows rows={8} /> : null}

        {data && data.items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No payments match these filters' : 'No payments yet'}
            body={
              filtered
                ? 'Try a broader search, or clear the filters to see the full book.'
                : 'Create the first payment to see it risk-assessed, journaled, and finalized.'
            }
            action={
              <button type="button" className="btn btn--primary" onClick={onCompose}>
                New payment
              </button>
            }
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="table table--interactive">
                <thead>
                  <tr>
                    {SORTABLE.slice(0, 1).map((column) => (
                      <th key={column.key}>
                        <SortHeader
                          column={column}
                          sort={sort}
                          direction={direction}
                          onToggle={toggleSort}
                        />
                      </th>
                    ))}
                    <th>Counterparty</th>
                    {SORTABLE.slice(1).map((column) => (
                      <th key={column.key} className={column.numeric ? 'numeric' : undefined}>
                        <SortHeader
                          column={column}
                          sort={sort}
                          direction={direction}
                          onToggle={toggleSort}
                        />
                      </th>
                    ))}
                    <th>Ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((payment) => (
                    <tr
                      key={payment.id}
                      tabIndex={0}
                      onClick={() => onSelectPayment(payment.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') onSelectPayment(payment.id)
                      }}
                    >
                      <td>
                        <div className="stack stack--tight">
                          <span className="mono">{payment.reference}</span>
                          <span className="text-caption text-tertiary truncate">
                            {payment.description}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Party
                          party={payment.recipient}
                          meta={`from ${payment.sender.displayName}`}
                        />
                      </td>
                      <td className="numeric">
                        <Money amountMinor={payment.amountMinor} currency={payment.currency} />
                      </td>
                      <td>
                        <StatusPill status={payment.status} />
                      </td>
                      <td className="numeric">
                        <span className="tnum">{payment.riskScore}</span>
                        {payment.riskSignals.length > 0 ? (
                          <span className="text-caption text-tertiary">
                            {' '}
                            · {payment.riskSignals.length}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-secondary">{formatDateTime(payment.createdAt)}</td>
                      <td>
                        {payment.journalPosted ? (
                          <TonePill tone="success">Posted</TonePill>
                        ) : (
                          <TonePill tone="neutral">None</TonePill>
                        )}
                      </td>
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
                noun="payment"
              />
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

function SortHeader({
  column,
  sort,
  direction,
  onToggle,
}: {
  readonly column: { readonly key: string; readonly label: string }
  readonly sort: string
  readonly direction: 'ASC' | 'DESC'
  readonly onToggle: (key: string) => void
}) {
  const active = sort === column.key
  const Icon = direction === 'ASC' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      className="sort-button"
      data-active={active}
      aria-sort={active ? (direction === 'ASC' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onToggle(column.key)}
    >
      {column.label}
      {active ? <Icon size={12} aria-hidden="true" /> : null}
    </button>
  )
}
