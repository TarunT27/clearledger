import { describe, expect, it } from 'vitest'
import {
  createOperationsFixture,
  filterPayments,
  paginatePayments,
  repairReconciliationCase,
} from './operationsData'

describe('operations data model', () => {
  it('filters payments by text and operational status', () => {
    const fixture = createOperationsFixture()

    expect(filterPayments(fixture.payments, { query: 'summit', status: 'all', risk: 'all' }))
      .toHaveLength(1)
    expect(filterPayments(fixture.payments, { query: '', status: 'review', risk: 'all' })
      .every((payment) => payment.status === 'Review')).toBe(true)
    expect(filterPayments(fixture.payments, { query: '', status: 'all', risk: 'Review' })
      .every((payment) => payment.riskDecision === 'Review')).toBe(true)
  })

  it('paginates without inventing a hard-coded total', () => {
    const fixture = createOperationsFixture()
    const page = paginatePayments(fixture.payments, 2, 10)

    expect(page.items).toHaveLength(10)
    expect(page.total).toBe(fixture.payments.length)
    expect(page.pageCount).toBe(Math.ceil(fixture.payments.length / 10))
    expect(page.items[0]).toEqual(fixture.payments[10])
  })

  it('repairs a reconciliation case without creating another journal', () => {
    const fixture = createOperationsFixture()
    const target = fixture.reconciliationCases.find((item) => item.paymentId === 'pay_8C42')
    const payment = fixture.payments.find((item) => item.id === 'pay_8C42')

    expect(target).toBeDefined()
    expect(payment).toBeDefined()

    const repaired = repairReconciliationCase(fixture, target!.id)
    const repairedPayment = repaired.payments.find((item) => item.id === target!.paymentId)
    const journals = repaired.journals.filter((journal) => journal.paymentId === target!.paymentId)

    expect(repaired.reconciliationCases.find((item) => item.id === target!.id)?.state).toBe('Repaired')
    expect(repairedPayment?.status).toBe('Approved')
    expect(journals).toHaveLength(1)
    expect(journals[0].balanced).toBe(true)
  })

  it('rejects a stale reconciliation repair before changing any records', () => {
    const fixture = createOperationsFixture()
    const target = fixture.reconciliationCases.find((item) => item.paymentId === 'pay_8C42')

    expect(target).toBeDefined()

    const staleCaseFixture = {
      ...fixture,
      reconciliationCases: fixture.reconciliationCases.map((item) => item.id === target!.id
        ? { ...item, currentVersion: item.currentVersion + 1 }
        : item),
    }
    const stalePaymentFixture = {
      ...fixture,
      payments: fixture.payments.map((payment) => payment.id === target!.paymentId
        ? { ...payment, version: payment.version + 1 }
        : payment),
    }

    expect(() => repairReconciliationCase(staleCaseFixture, target!.id))
      .toThrow(/stale reconciliation case/i)
    expect(() => repairReconciliationCase(stalePaymentFixture, target!.id))
      .toThrow(/stale payment version/i)
    expect(fixture.reconciliationCases.find((item) => item.id === target!.id)?.state).toBe('Queued')
  })
})
