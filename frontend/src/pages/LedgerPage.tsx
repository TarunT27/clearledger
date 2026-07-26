import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { JournalRecord, OperationsFixture } from '../lib/operationsData'
import '../styles/operationsPages.css'

export interface LedgerPageProps {
  readonly fixture: OperationsFixture
  readonly onSelectPayment: (paymentId: string) => void
}

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
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

function matchesJournal(journal: JournalRecord, query: string): boolean {
  if (!query) return true
  const searchable = [
    journal.id,
    journal.paymentId,
    journal.source,
    journal.currency,
    ...journal.lines.map((line) => line.account),
  ].join(' ').toLocaleLowerCase()
  return searchable.includes(query)
}

export function LedgerPage({ fixture, onSelectPayment }: LedgerPageProps) {
  const [query, setQuery] = useState('')
  const [selectedJournalId, setSelectedJournalId] = useState(
    fixture.journals[0]?.id ?? '',
  )

  const filteredJournals = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return fixture.journals.filter((journal) => matchesJournal(journal, normalizedQuery))
  }, [fixture.journals, query])

  const selectedJournal = fixture.journals.find(
    (journal) => journal.id === selectedJournalId,
  ) ?? filteredJournals[0] ?? null

  return (
    <div className="operations-page operations-page--ledger">
      <header className="operations-page__header">
        <div>
          <span className="operations-eyebrow">Accounting controls</span>
          <h1>Ledger explorer</h1>
          <p>Trace each payment to its immutable, double-entry journal evidence.</p>
        </div>
        <div className="operations-page__summary" aria-label="Ledger summary">
          <BookOpen size={18} aria-hidden="true" />
          <span>
            <strong>{fixture.journals.length}</strong>
            balanced journals
          </span>
        </div>
      </header>

      <div className="ledger-workspace">
        <section className="operations-panel ledger-list" aria-labelledby="journal-list-title">
          <div className="operations-panel__header operations-panel__header--toolbar">
            <div>
              <h2 id="journal-list-title">Journal entries</h2>
              <p>{filteredJournals.length} matching records</p>
            </div>
            <label className="operations-search">
              <span className="sr-only">Search journals</span>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search journal, payment, source…"
              />
            </label>
          </div>

          <div className="operations-table-scroll">
            <table className="operations-table" aria-label="Journals">
              <thead>
                <tr>
                  <th>Journal</th>
                  <th>Payment</th>
                  <th>Source</th>
                  <th>Created</th>
                  <th className="numeric">Debits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredJournals.map((journal) => (
                  <tr
                    key={journal.id}
                    className={journal.id === selectedJournal?.id ? 'is-selected' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="operations-link operations-link--mono"
                        aria-label={`View journal ${journal.id}`}
                        onClick={() => setSelectedJournalId(journal.id)}
                      >
                        {journal.id}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="operations-link operations-link--mono"
                        onClick={() => onSelectPayment(journal.paymentId)}
                      >
                        {journal.paymentId}
                      </button>
                    </td>
                    <td>{journal.source}</td>
                    <td><time dateTime={journal.createdAt}>{formatDate(journal.createdAt)}</time></td>
                    <td className="numeric">
                      {formatMoney(journal.totalDebits, journal.currency)}
                    </td>
                    <td>
                      <span className={`operation-badge operation-badge--${journal.balanced ? 'success' : 'danger'}`}>
                        {journal.balanced ? 'Balanced' : 'Out of balance'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredJournals.length === 0 ? (
            <div className="operations-empty" role="status">
              <Search size={22} aria-hidden="true" />
              <strong>No journals match your search</strong>
              <button type="button" className="operations-text-button" onClick={() => setQuery('')}>
                Clear search
              </button>
            </div>
          ) : null}
        </section>

        <aside className="operations-panel journal-evidence" aria-label="Journal evidence">
          {selectedJournal ? (
            <>
              <div className="operations-panel__header">
                <div>
                  <span className="operations-eyebrow">Selected journal</span>
                  <h2>{selectedJournal.id}</h2>
                </div>
                <span className={`operation-badge operation-badge--${selectedJournal.balanced ? 'success' : 'danger'}`}>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {selectedJournal.balanced ? 'Balanced' : 'Review'}
                </span>
              </div>

              <dl className="operations-definition-list">
                <div>
                  <dt>Payment</dt>
                  <dd>
                    <button
                      type="button"
                      className="operations-link operations-link--mono"
                      aria-label={`Open payment ${selectedJournal.paymentId}`}
                      onClick={() => onSelectPayment(selectedJournal.paymentId)}
                    >
                      {selectedJournal.paymentId}
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </button>
                  </dd>
                </div>
                <div><dt>Source</dt><dd>{selectedJournal.source}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(selectedJournal.createdAt)}</dd></div>
              </dl>

              <div className="journal-balance" aria-label="Debit and credit balance">
                <div>
                  <span>Debit total</span>
                  <strong>{formatMoney(selectedJournal.totalDebits, selectedJournal.currency)}</strong>
                </div>
                <CircleDollarSign size={24} aria-hidden="true" />
                <div>
                  <span>Credit total</span>
                  <strong>{formatMoney(selectedJournal.totalCredits, selectedJournal.currency)}</strong>
                </div>
              </div>

              <div className="operations-table-scroll operations-table-scroll--compact">
                <table className="operations-table operations-table--compact" aria-label="Journal lines">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Side</th>
                      <th className="numeric">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJournal.lines.map((line, index) => (
                      <tr key={`${line.account}-${line.side}-${index}`}>
                        <td>{line.account}</td>
                        <td>{line.side}</td>
                        <td className="numeric">
                          {formatMoney(line.amount, selectedJournal.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="operations-empty" role="status">
              <BookOpen size={22} aria-hidden="true" />
              <strong>No journal evidence available</strong>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
