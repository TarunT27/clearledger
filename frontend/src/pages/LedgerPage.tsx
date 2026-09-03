import { CheckCircle2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { consoleApi } from '../lib/consoleApi'
import type { JournalView } from '../lib/consoleTypes'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatDateTime, formatMoney } from '../lib/format'
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

const PAGE_SIZE = 15

export interface LedgerPageProps {
  readonly onSelectPayment: (paymentId: string) => void
  readonly reloadToken: number
}

/**
 * The ledger workbench.
 *
 * Balance is not a stored flag: each row shows the debit and credit totals the API summed
 * from the journal's own entries, so "balanced" is a claim the reader can check against the
 * two numbers printed beside it.
 */
export function LedgerPage({ onSelectPayment, reloadToken }: LedgerPageProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebounced(query)

  useEffect(() => setPage(0), [debounced])

  const load = useCallback(
    (signal: AbortSignal) => consoleApi.journals(debounced, page, PAGE_SIZE, signal),
    [debounced, page],
  )
  const { data, error, loading, refreshing, reload } = useResource(load, [
    debounced,
    page,
    reloadToken,
  ])

  function exportCsv(rows: readonly JournalView[]) {
    downloadCsv(
      `clearledger-journals-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['Journal', 'Payment', 'Counterparty', 'Currency', 'Debits', 'Credits', 'Balanced', 'Posted'],
        rows.map((journal) => [
          journal.reference,
          journal.paymentReference,
          journal.counterpartyName,
          journal.currency,
          (journal.totalDebitsMinor / 100).toFixed(2),
          (journal.totalCreditsMinor / 100).toFixed(2),
          journal.balanced ? 'yes' : 'no',
          journal.createdAt,
        ]),
      ),
    )
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Double-entry"
        title="Ledger"
        lede="Committed journals with their own debit and credit totals. A journal belongs to exactly one payment and never moves."
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
        <div className="card__body" style={{ padding: 'var(--space-4)' }}>
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search journals"
            placeholder="Payment reference, description, counterparty, currency…"
          />
        </div>
      </section>

      <section className="card card--flush">
        {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}
        {loading && !data ? <LoadingRows rows={7} /> : null}
        {data && data.items.length === 0 ? (
          <EmptyState
            title="No journals to show"
            body="A journal is written only when the risk engine approves a payment, so an empty ledger means nothing has been approved yet."
          />
        ) : null}

        {data && data.items.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="table table--interactive">
                <thead>
                  <tr>
                    <th>Journal</th>
                    <th>Payment</th>
                    <th>Counterparty</th>
                    <th className="numeric">Debits</th>
                    <th className="numeric">Credits</th>
                    <th>Integrity</th>
                    <th>Posted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((journal) => (
                    <tr
                      key={journal.id}
                      tabIndex={0}
                      onClick={() => onSelectPayment(journal.paymentId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') onSelectPayment(journal.paymentId)
                      }}
                    >
                      <td>
                        <span className="mono">{journal.reference}</span>
                      </td>
                      <td>
                        <span className="mono text-secondary">
                          {journal.paymentReference ?? '—'}
                        </span>
                      </td>
                      <td className="truncate">{journal.counterpartyName ?? '—'}</td>
                      <td className="numeric">
                        {formatMoney(journal.totalDebitsMinor, journal.currency)}
                      </td>
                      <td className="numeric">
                        {formatMoney(journal.totalCreditsMinor, journal.currency)}
                      </td>
                      <td>
                        <span className="row">
                          {journal.balanced ? (
                            <TonePill tone="success">
                              <CheckCircle2 size={12} aria-hidden="true" /> Balanced
                            </TonePill>
                          ) : (
                            <TonePill tone="danger">
                              <XCircle size={12} aria-hidden="true" /> Unbalanced
                            </TonePill>
                          )}
                          {journal.matchesPayment ? null : (
                            <TonePill tone="warning">Mismatch</TonePill>
                          )}
                        </span>
                      </td>
                      <td className="text-secondary">{formatDateTime(journal.createdAt)}</td>
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
                noun="journal"
              />
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}
