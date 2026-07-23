import { describe, expect, it } from 'vitest'
import { buildScenario, toneForDecision } from './demoApi'

describe('demo scenario state', () => {
  it('builds a normal payment with one balanced journal', () => {
    const result = buildScenario('normal')
    const payment = result.payments[0]

    expect(result.heading).toContain('approved')
    expect(payment.status).toBe('Approved')
    expect(payment.ledgerLines).toHaveLength(2)
    expect(payment.ledgerLines[0].amount).toBe(payment.ledgerLines[1].amount)
  })

  it('models a duplicate response without another payment or journal', () => {
    const result = buildScenario('duplicate')
    const selected = result.payments[0]

    expect(result.payments.filter((payment) => payment.id === selected.id)).toHaveLength(1)
    expect(selected.ledgerLines).toHaveLength(2)
    expect(selected.audit.at(-1)?.detail).toContain('no ledger write')
  })

  it('keeps timeout repair immutable between pending and repaired results', () => {
    const pending = buildScenario('timeout')
    const repaired = buildScenario('timeout', true)

    expect(pending.payments[0].status).toBe('Unknown')
    expect(pending.reconciliation?.repaired).toBe(false)
    expect(repaired.payments[0].status).toBe('Approved')
    expect(repaired.reconciliation?.result).toContain('no duplicate ledger write')
    expect(pending.payments[0].status).toBe('Unknown')
  })

  it('maps decisions to semantic tones', () => {
    expect(toneForDecision('APPROVED')).toBe('success')
    expect(toneForDecision('REVIEW')).toBe('warning')
    expect(toneForDecision('REJECTED')).toBe('danger')
    expect(toneForDecision('OTHER')).toBe('neutral')
  })
})
