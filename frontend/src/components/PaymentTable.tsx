import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Payment } from '../types'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

function textTone(value: string): string {
  if (value === 'Timed out' || value === 'Unknown') return 'text-danger'
  if (value.includes('Approved') || value.includes('Balanced') || value.includes('Duplicate')) return 'text-success'
  return ''
}

export function PaymentTable({
  payments,
  selectedId,
  onSelect,
}: {
  readonly payments: readonly Payment[]
  readonly selectedId: string
  readonly onSelect: (id: string) => void
}) {
  return (
    <section className="payment-table-panel" aria-labelledby="payments-title">
      <h2 className="sr-only" id="payments-title">Recent payments</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Payment</th>
              <th>Recipient</th>
              <th className="numeric">Amount</th>
              <th>Risk</th>
              <th>Ledger</th>
              <th>Processor</th>
              <th>Status</th>
              <th>Updated <ChevronDown size={14} aria-hidden="true" /></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr
                key={payment.id}
                className={selectedId === payment.id ? 'is-selected' : ''}
                onClick={() => onSelect(payment.id)}
              >
                <td>
                  <button
                    type="button"
                    className="payment-id"
                    aria-label={`View payment ${payment.id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(payment.id)
                    }}
                  >
                    {payment.id}
                  </button>
                </td>
                <td>{payment.recipient}</td>
                <td className="numeric">{currency.format(payment.amount)}</td>
                <td className={textTone(payment.risk)}>{payment.risk}</td>
                <td className={textTone(payment.ledger)}>{payment.ledger}</td>
                <td className={textTone(payment.processor)}>{payment.processor}</td>
                <td className={textTone(payment.status)}>{payment.status}</td>
                <td><time>{payment.updatedAt.replace(`${BASE_DATE} `, '')}<br />{BASE_DATE}</time></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="table-pagination">
        <span>Showing 1 to {payments.length} of 250 payments</span>
        <div className="page-controls" aria-label="Pagination">
          <button type="button" aria-label="Previous page"><ChevronLeft size={17} /></button>
          <button type="button" className="is-current" aria-current="page">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <span>…</span>
          <button type="button">50</button>
          <button type="button" aria-label="Next page"><ChevronRight size={17} /></button>
        </div>
        <label className="rows-select">
          <span>Rows per page:</span>
          <select defaultValue="5" aria-label="Rows per page">
            <option value="5">5</option>
            <option value="10">10</option>
          </select>
        </label>
      </footer>
    </section>
  )
}

const BASE_DATE = 'May 16, 2025'
