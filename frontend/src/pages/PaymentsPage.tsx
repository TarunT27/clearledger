import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { escapeCsvCell } from '../lib/csv'
import type { OperationsFixture, PaymentRecord } from '../lib/operationsData'
import '../styles/payments.css'

type PaymentFilter = 'all' | 'approved' | 'review' | 'rejected' | 'unknown'
type SortDirection = 'ascending' | 'descending'

export interface PaymentsPageProps {
  readonly data: OperationsFixture
  readonly initialQuery?: string
  readonly selectedPaymentId?: string | null
  readonly onSelectPayment: (id: string) => void
  readonly onCreatePayment: (input: { amount: number; recipient: string }) => void | Promise<void>
  readonly onClearGlobalQuery: () => void
}

const FILTER_OPTIONS: readonly { value: PaymentFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'review', label: 'Review' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'unknown', label: 'Unknown' },
]

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }
}

function formatLedgerMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function paymentMatches(
  payment: PaymentRecord,
  query: string,
  status: PaymentFilter,
  risk: PaymentFilter,
  currency: string,
): boolean {
  const normalizedQuery = normalize(query)
  const searchable = [
    payment.id,
    payment.recipient,
    payment.merchant,
    payment.description,
    payment.processor,
    payment.paymentMethod,
    payment.currency,
    payment.status,
    payment.riskDecision,
    payment.amount,
  ].join(' ').toLocaleLowerCase()

  return (
    (!normalizedQuery || searchable.includes(normalizedQuery))
    && (status === 'all' || normalize(payment.status) === status)
    && (risk === 'all' || normalize(payment.riskDecision) === risk)
    && (currency === 'all' || payment.currency === currency)
  )
}

function StatusBadge({ value }: { readonly value: string }) {
  return (
    <span className={`payments-status payments-status--${normalize(value)}`}>
      {value}
    </span>
  )
}

interface PaymentFormProps {
  readonly onClose: () => void
  readonly onCreate: PaymentsPageProps['onCreatePayment']
  readonly onCreated: (message: string) => void
}

function PaymentForm({ onClose, onCreate, onCreated }: PaymentFormProps) {
  const titleId = useId()
  const errorId = useId()
  const amountId = useId()
  const recipientId = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    amountRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
      previousFocusRef.current?.focus()
    }
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    const cleanRecipient = recipient.trim()

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1_000_000) {
      setError('Enter an amount between 0.01 and 1,000,000.')
      return
    }
    if (cleanRecipient.length < 3 || cleanRecipient.length > 120) {
      setError('Enter a recipient between 3 and 120 characters.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await onCreate({ amount: parsedAmount, recipient: cleanRecipient })
      onCreated(`Payment for ${cleanRecipient} created.`)
      onClose()
    } catch {
      setError('The payment could not be created. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function stopOverlayClose(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation()
  }

  return (
    <div className="payments-modal-layer" onMouseDown={onClose}>
      <div
        className="payments-composer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={stopOverlayClose}
      >
        <header className="payments-composer__header">
          <div>
            <h2 id={titleId}>New payment</h2>
            <p>Create a payment for an approved recipient.</p>
          </div>
          <button type="button" className="payments-icon-button" aria-label="Close new payment" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit} noValidate>
          <div className="payments-field">
            <label htmlFor={amountId}>Amount</label>
            <div className="payments-amount-input">
              <span aria-hidden="true">$</span>
              <input
                ref={amountRef}
                id={amountId}
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby={error ? errorId : undefined}
                placeholder="0.00"
              />
              <span>USD</span>
            </div>
          </div>

          <div className="payments-field">
            <label htmlFor={recipientId}>Recipient</label>
            <input
              id={recipientId}
              name="recipient"
              autoComplete="off"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              aria-describedby={error ? errorId : undefined}
              placeholder="Recipient or account"
            />
          </div>

          {error ? <p className="payments-form-error" id={errorId} role="alert">{error}</p> : null}

          <footer className="payments-composer__actions">
            <button type="button" className="payments-button payments-button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="payments-button payments-button--primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create payment'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

interface PaymentDetailsProps {
  readonly payment: PaymentRecord
  readonly onClose: () => void
  readonly onCopy: (paymentId: string) => void
}

function PaymentDetails({ payment, onClose, onCopy }: PaymentDetailsProps) {
  const [showFullRecord, setShowFullRecord] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const debitTotal = payment.ledgerLines
    .filter((line) => line.side === 'Debit')
    .reduce((total, line) => total + line.amount, 0)
  const creditTotal = payment.ledgerLines
    .filter((line) => line.side === 'Credit')
    .reduce((total, line) => total + line.amount, 0)
  const hasLedgerEntries = payment.ledgerLines.length > 0
  const isBalanced = hasLedgerEntries && Math.abs(debitTotal - creditTotal) < 0.005

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    closeButtonRef.current?.focus()

    function keepFocusInDialog(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)
      if (!firstElement || !lastElement) return

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', keepFocusInDialog)
    return () => {
      document.removeEventListener('keydown', keepFocusInDialog)
      previouslyFocusedElement?.focus()
    }
  }, [])

  return (
    <>
      <div className="payments-details-scrim" aria-hidden="true" onClick={onClose} />
      <aside
        ref={dialogRef}
        className="payments-details"
        role="dialog"
        aria-modal="true"
        aria-label="Payment details"
      >
        <header className="payments-details__header">
          <div>
            <span className="payments-details__eyebrow">Payment details</span>
            <code>{payment.id}</code>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="payments-icon-button"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <section className="payments-details__hero">
          <div>
            <h2>{payment.recipient}</h2>
            <p>{payment.description}</p>
          </div>
          <strong>{formatMoney(payment.amount, payment.currency)}</strong>
          <StatusBadge value={payment.status} />
        </section>

        <section className="payments-detail-section" aria-labelledby="risk-evidence-heading">
          <header>
            <div>
              <ShieldCheck size={17} aria-hidden="true" />
              <h3 id="risk-evidence-heading">Risk evidence</h3>
            </div>
            <StatusBadge value={payment.riskEvidence.decision} />
          </header>
          <dl className="payments-key-values">
            <div><dt>Score</dt><dd>{payment.riskEvidence.score}</dd></div>
            <div><dt>Policy</dt><dd>{payment.riskEvidence.policy}</dd></div>
            {payment.riskEvidence.signals.map((signal) => (
              <div key={`${signal.label}-${signal.outcome}`}>
                <dt>{signal.label}</dt>
                <dd className={`payments-tone--${signal.tone}`}>{signal.outcome}</dd>
              </div>
            ))}
            <div><dt>Evaluated</dt><dd>{formatTimestamp(payment.riskEvidence.timestamp)}</dd></div>
          </dl>
        </section>

        <section className="payments-detail-section" aria-labelledby="ledger-entries-heading">
          <header>
            <div>
              <Check size={17} aria-hidden="true" />
              <h3 id="ledger-entries-heading">Ledger entries</h3>
            </div>
            <span className={isBalanced ? 'payments-balance payments-balance--ok' : 'payments-balance'}>
              {isBalanced ? 'Balanced' : hasLedgerEntries ? 'Out of balance' : 'Not posted'}
            </span>
          </header>
          {hasLedgerEntries ? (
            <div className="payments-ledger">
              {payment.ledgerLines.map((line, index) => (
                <div className="payments-ledger__row" key={`${line.account}-${line.side}-${index}`}>
                  <span>{line.account}</span>
                  <span>{line.side}</span>
                  <strong>{formatLedgerMoney(line.amount, payment.currency)}</strong>
                </div>
              ))}
              <footer>
                <span>Debits {formatLedgerMoney(debitTotal, payment.currency)}</span>
                <span>Credits {formatLedgerMoney(creditTotal, payment.currency)}</span>
              </footer>
            </div>
          ) : (
            <p className="payments-ledger-empty">No ledger entries were created for this payment.</p>
          )}
        </section>

        <section className="payments-detail-section" aria-labelledby="audit-timeline-heading">
          <header>
            <div>
              <h3 id="audit-timeline-heading">Audit timeline</h3>
            </div>
          </header>
          <ol className="payments-audit">
            {payment.audit.map((event) => (
              <li className={`payments-audit__event payments-audit__event--${event.state}`} key={event.id}>
                <span className="payments-audit__marker" aria-hidden="true" />
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                  <time dateTime={event.timestamp}>
                    {formatTimestamp(event.timestamp)} · {event.actor}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {showFullRecord ? (
          <section className="payments-detail-section payments-full-record" aria-labelledby="full-record-heading">
            <header>
              <div><h3 id="full-record-heading">Full record</h3></div>
            </header>
            <dl className="payments-key-values">
              <div><dt>Processor</dt><dd>{payment.processor}</dd></div>
              <div><dt>Payment method</dt><dd>{payment.paymentMethod}</dd></div>
              <div><dt>Merchant</dt><dd>{payment.merchant}</dd></div>
              <div><dt>Idempotency key</dt><dd>{payment.idempotencyKey}</dd></div>
              <div><dt>Journal</dt><dd>{payment.journalId ?? 'Not posted'}</dd></div>
              <div><dt>Version</dt><dd>v{payment.version}</dd></div>
            </dl>
          </section>
        ) : null}

        <footer className="payments-details__actions">
          <button type="button" className="payments-button payments-button--secondary" onClick={() => onCopy(payment.id)}>
            <Copy size={15} aria-hidden="true" />
            Copy ID
          </button>
          <button
            type="button"
            className="payments-button payments-button--primary"
            aria-expanded={showFullRecord}
            onClick={() => setShowFullRecord((current) => !current)}
          >
            <ExternalLink size={15} aria-hidden="true" />
            {showFullRecord ? 'Hide full record' : 'Open full record'}
          </button>
        </footer>
      </aside>
    </>
  )
}

export function PaymentsPage({
  data,
  initialQuery = '',
  selectedPaymentId = null,
  onSelectPayment,
  onCreatePayment,
  onClearGlobalQuery,
}: PaymentsPageProps) {
  const [query, setQuery] = useState(initialQuery)
  const [status, setStatus] = useState<PaymentFilter>('all')
  const [risk, setRisk] = useState<PaymentFilter>('all')
  const [currency, setCurrency] = useState('all')
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending')
  const [rowsPerPage, setRowsPerPage] = useState<10 | 25>(25)
  const [page, setPage] = useState(1)
  const [activePaymentId, setActivePaymentId] = useState<string | null>(selectedPaymentId)
  const [showComposer, setShowComposer] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    setActivePaymentId(selectedPaymentId)
  }, [selectedPaymentId])

  useEffect(() => {
    setPage(1)
  }, [query, status, risk, currency, rowsPerPage])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const currencies = useMemo(
    () => [...new Set(data.payments.map((payment) => payment.currency))].sort(),
    [data.payments],
  )

  const filteredPayments = useMemo(() => {
    return [...data.payments]
      .filter((payment) => paymentMatches(payment, query, status, risk, currency))
      .sort((left, right) => {
        const difference = timestampValue(left.updatedAt) - timestampValue(right.updatedAt)
        return sortDirection === 'ascending' ? difference : -difference
      })
  }, [currency, data.payments, query, risk, sortDirection, status])

  const total = filteredPayments.length
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage))
  const safePage = Math.min(page, pageCount)
  const startIndex = (safePage - 1) * rowsPerPage
  const visiblePayments = filteredPayments.slice(startIndex, startIndex + rowsPerPage)
  const showingStart = total === 0 ? 0 : startIndex + 1
  const showingEnd = total === 0 ? 0 : startIndex + visiblePayments.length
  const selectedPayment = activePaymentId
    ? data.payments.find((payment) => payment.id === activePaymentId) ?? null
    : null
  const reviewCount = data.payments.filter((payment) => payment.status === 'Review').length
  const approvedCount = data.payments.filter((payment) => payment.status === 'Approved').length

  function selectPayment(paymentId: string) {
    setActivePaymentId(paymentId)
    onSelectPayment(paymentId)
  }

  function clearSearch() {
    setQuery('')
    onClearGlobalQuery()
  }

  function exportCsv() {
    const headers = [
      'Payment ID',
      'Recipient',
      'Merchant',
      'Amount',
      'Currency',
      'Status',
      'Risk decision',
      'Processor',
      'Updated',
    ]
    const rows = filteredPayments.map((payment) => [
      payment.id,
      payment.recipient,
      payment.merchant,
      payment.amount,
      payment.currency,
      payment.status,
      payment.riskDecision,
      payment.processor,
      payment.updatedAt,
    ])
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const objectUrl = typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(blob)
      : `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'clearledger-payments.csv'
    document.body.append(link)
    link.click()
    link.remove()
    if (objectUrl.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl)
    }
    setNotice(`Exported ${filteredPayments.length} payments to CSV.`)
  }

  async function copyPaymentId(paymentId: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(paymentId)
    } catch {
      const text = document.createElement('textarea')
      text.value = paymentId
      text.style.position = 'fixed'
      text.style.opacity = '0'
      document.body.append(text)
      text.select()
      document.execCommand?.('copy')
      text.remove()
    }
    setNotice(`Copied payment ID ${paymentId}.`)
  }

  return (
    <div className="payments-page">
      <header className="payments-page__header">
        <div>
          <h1>Payments</h1>
          <p>Monitor payment decisions, risk evidence, and balanced ledger activity.</p>
        </div>
        <button type="button" className="payments-button payments-button--primary" onClick={() => setShowComposer(true)}>
          <Plus size={17} aria-hidden="true" />
          New payment
        </button>
      </header>

      <dl className="payments-summary" aria-label="Payment summary">
        <div><dt>Total payments</dt><dd>{data.payments.length}</dd></div>
        <div><dt>Approved</dt><dd>{approvedCount}</dd></div>
        <div><dt>Needs review</dt><dd>{reviewCount}</dd></div>
      </dl>

      <section className="payments-workspace" aria-label="Payments workspace">
        <div className="payments-toolbar">
          <div className="payments-search">
            <label className="sr-only" htmlFor="payments-search-input">Search payments</label>
            <Search size={16} aria-hidden="true" />
            <input
              id="payments-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search payments, recipients, IDs…"
            />
            {query ? (
              <button type="button" aria-label="Clear payment search" onClick={clearSearch}>
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <label className="payments-filter">
            <span>Payment status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as PaymentFilter)}>
              {FILTER_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="payments-filter">
            <span>Risk decision</span>
            <select value={risk} onChange={(event) => setRisk(event.target.value as PaymentFilter)}>
              {FILTER_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="payments-filter">
            <span>Currency</span>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="all">All currencies</option>
              {currencies.map((currencyCode) => (
                <option value={currencyCode} key={currencyCode}>{currencyCode}</option>
              ))}
            </select>
          </label>

          <button type="button" className="payments-button payments-button--secondary payments-export" onClick={exportCsv}>
            <Download size={16} aria-hidden="true" />
            Export CSV
          </button>
        </div>

        <div className="payments-table-wrap">
          <table aria-label="Payments">
            <thead>
              <tr>
                <th scope="col">Payment</th>
                <th scope="col">Recipient</th>
                <th scope="col" className="payments-numeric">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Risk decision</th>
                <th scope="col">Currency</th>
                <th scope="col">Processor</th>
                <th scope="col" aria-sort={sortDirection}>
                  <button
                    type="button"
                    className="payments-sort"
                    onClick={() => setSortDirection((current) => (
                      current === 'descending' ? 'ascending' : 'descending'
                    ))}
                  >
                    Updated
                    {sortDirection === 'descending'
                      ? <ArrowDown size={14} aria-hidden="true" />
                      : <ArrowUp size={14} aria-hidden="true" />}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.length ? visiblePayments.map((payment) => (
                <tr className={activePaymentId === payment.id ? 'is-selected' : ''} key={payment.id}>
                  <td data-label="Payment">
                    <button
                      type="button"
                      className="payments-payment-id"
                      aria-label={`View payment ${payment.id}`}
                      onClick={() => selectPayment(payment.id)}
                    >
                      {payment.id}
                    </button>
                  </td>
                  <td data-label="Recipient">
                    <strong>{payment.recipient}</strong>
                    {payment.merchant !== payment.recipient ? <span>{payment.merchant}</span> : null}
                  </td>
                  <td data-label="Amount" className="payments-numeric">
                    {formatMoney(payment.amount, payment.currency)}
                  </td>
                  <td data-label="Status"><StatusBadge value={payment.status} /></td>
                  <td data-label="Risk decision"><StatusBadge value={payment.riskDecision} /></td>
                  <td data-label="Currency">{payment.currency}</td>
                  <td data-label="Processor">{payment.processor}</td>
                  <td data-label="Updated">
                    <time dateTime={payment.updatedAt}>{formatTimestamp(payment.updatedAt)}</time>
                  </td>
                </tr>
              )) : (
                <tr className="payments-empty-row">
                  <td colSpan={8}>
                    <strong>No payments found</strong>
                    <span>Adjust the search or filters to see more results.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="payments-pagination">
          <p aria-live="polite">Showing {showingStart}–{showingEnd} of {total}</p>
          <div className="payments-page-controls" aria-label="Payments pagination">
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span>Page {safePage} of {pageCount}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <label className="payments-rows">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(event) => setRowsPerPage(Number(event.target.value) as 10 | 25)}
            >
              <option value="10">10</option>
              <option value="25">25</option>
            </select>
          </label>
        </footer>
      </section>

      {showComposer ? (
        <PaymentForm
          onClose={() => setShowComposer(false)}
          onCreate={onCreatePayment}
          onCreated={setNotice}
        />
      ) : null}

      {selectedPayment ? (
        <PaymentDetails
          key={selectedPayment.id}
          payment={selectedPayment}
          onClose={() => setActivePaymentId(null)}
          onCopy={(paymentId) => void copyPaymentId(paymentId)}
        />
      ) : null}

      {notice ? (
        <div className="payments-toast" role="status">
          <Check size={17} aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default PaymentsPage
