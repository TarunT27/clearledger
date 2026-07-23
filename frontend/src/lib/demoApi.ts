import type {
  AuditEvent,
  CreatePaymentInput,
  Payment,
  Reconciliation,
  ScenarioName,
  ScenarioResult,
  Tone,
} from '../types'

const BASE_DATE = 'May 16, 2025'

const money = (amount: number) => Math.round(amount * 100) / 100

function riskEvidence(
  decision: Payment['riskEvidence']['decision'],
  score: number,
  timestamp: string,
  repeatedAttempts = 'Passed · 1 in 10 min',
): Payment['riskEvidence'] {
  return {
    decision,
    score,
    policy: 'business_transfer_v4',
    timestamp,
    signals: [
      { label: 'Unusual amount', outcome: score > 0.65 ? 'Triggered' : 'Within range', tone: score > 0.65 ? 'warning' : 'success' },
      { label: 'Repeated attempts', outcome: repeatedAttempts, tone: repeatedAttempts.includes('duplicate') ? 'info' : 'success' },
      { label: 'New recipient', outcome: 'Known · 14 months', tone: 'success' },
      { label: 'Velocity limit', outcome: 'Passed · 3 of 12', tone: 'success' },
    ],
  }
}

const settledAudit = (prefix: string): readonly AuditEvent[] => [
  { id: `${prefix}-1`, label: 'Payment received', detail: 'Request validated', timestamp: '10:21:03', state: 'complete' },
  { id: `${prefix}-2`, label: 'Risk approved', detail: 'Score 0.08', timestamp: '10:21:05', state: 'complete' },
  { id: `${prefix}-3`, label: 'Balanced ledger posted', detail: 'Atomic journal write', timestamp: '10:21:06', state: 'complete' },
  { id: `${prefix}-4`, label: 'Processor confirmed', detail: 'Settlement accepted', timestamp: '10:21:09', state: 'complete' },
  { id: `${prefix}-5`, label: 'Payment approved', detail: 'Final state committed', timestamp: '10:21:10', state: 'complete' },
]

const timeoutAudit = (repaired = false): readonly AuditEvent[] => [
  { id: 'timeout-1', label: 'Payment received', detail: 'Request validated', timestamp: '10:21:03', state: 'complete' },
  { id: 'timeout-2', label: 'Risk approved', detail: 'Score 0.08', timestamp: '10:21:05', state: 'complete' },
  { id: 'timeout-3', label: 'Balanced ledger posted', detail: 'Atomic journal write', timestamp: '10:21:06', state: 'complete' },
  { id: 'timeout-4', label: 'Timeout before finalization', detail: 'Processor response missing', timestamp: '10:21:36', state: 'warning' },
  { id: 'timeout-5', label: 'Reconciliation detected mismatch', detail: 'Ledger posted · payment unknown', timestamp: '10:23:14', state: 'warning' },
  {
    id: 'timeout-6',
    label: repaired ? 'Safe CAS approval repair' : 'Safe CAS approval repair',
    detail: repaired ? 'Version 3 matched · approved' : 'Pending operator reconciliation',
    timestamp: repaired ? '10:23:18' : '—',
    state: repaired ? 'complete' : 'pending',
  },
]

function payment(
  id: string,
  recipient: string,
  amount: number,
  overrides: Partial<Payment> = {},
): Payment {
  return {
    id,
    recipient,
    amount: money(amount),
    currency: 'USD',
    risk: 'Approved',
    ledger: 'Balanced',
    processor: 'ACH Network',
    status: 'Approved',
    statusTone: 'success',
    updatedAt: `${BASE_DATE} 10:21:10`,
    idempotencyKey: `idem_${id.slice(4).toLowerCase()}`,
    version: 3,
    riskEvidence: riskEvidence('APPROVED', 0.08, `${BASE_DATE} 10:21:05 UTC`),
    ledgerLines: [
      { account: 'Clearing', side: 'Debit', amount: money(amount) },
      { account: 'Cash', side: 'Credit', amount: money(amount) },
    ],
    audit: settledAudit(id),
    ...overrides,
  }
}

const supportingPayments: readonly Payment[] = [
  payment('pay_8B91', 'Summit Office LLC', 3275.5, { updatedAt: `${BASE_DATE} 09:58:22` }),
  payment('pay_8A77', 'Clearline Consulting', 8950, { processor: 'FedNow', updatedAt: `${BASE_DATE} 09:41:11` }),
  payment('pay_8A12', 'Blue Ridge Partners', 25000, { updatedAt: `${BASE_DATE} 09:12:34` }),
  payment('pay_89F3', 'Northstar Supplies', 12480, {
    risk: 'Duplicate-safe',
    status: 'Duplicate-safe',
    updatedAt: `${BASE_DATE} 08:57:02`,
    riskEvidence: riskEvidence('APPROVED', 0.08, `${BASE_DATE} 08:57:02 UTC`, 'Blocked duplicate · same key'),
  }),
]

function scenarioPayment(scenario: ScenarioName, repaired = false): Payment {
  if (scenario === 'timeout') {
    return payment('pay_8C42', 'Northstar Supplies', 12480, {
      processor: repaired ? 'ACH Network' : 'Timed out',
      status: repaired ? 'Approved' : 'Unknown',
      statusTone: repaired ? 'success' : 'danger',
      updatedAt: `${BASE_DATE} ${repaired ? '10:23:18' : '10:23:14'}`,
      audit: timeoutAudit(repaired),
    })
  }

  if (scenario === 'duplicate') {
    return payment('pay_7D24', 'Atlas Components', 6800, {
      risk: 'Duplicate-safe',
      status: 'Approved · duplicate blocked',
      statusTone: 'success',
      processor: 'FedNow',
      idempotencyKey: 'idem_demo_duplicate_001',
      riskEvidence: riskEvidence('APPROVED', 0.06, `${BASE_DATE} 10:21:05 UTC`, 'Blocked duplicate · same key'),
      audit: [
        ...settledAudit('duplicate').slice(0, 4),
        {
          id: 'duplicate-5',
          label: 'Duplicate request replayed',
          detail: 'Original response returned · no ledger write',
          timestamp: '10:21:12',
          state: 'complete',
        },
      ],
    })
  }

  return payment('pay_7A1F', 'Meridian Logistics', 8600)
}

const reconciliation: Reconciliation = {
  runId: 'rec_207',
  mismatch: 'ledger posted / payment unknown',
  expectedVersion: 3,
  currentVersion: 3,
  repair: 'compare-and-swap approval',
  result: 'status → approved',
  repaired: false,
}

export function buildScenario(scenario: ScenarioName, repaired = false): ScenarioResult {
  const selected = scenarioPayment(scenario, repaired)
  const scenarioCopy: Record<ScenarioName, Pick<ScenarioResult, 'heading' | 'summary' | 'bannerTone'>> = {
    normal: {
      heading: 'Payment approved · ledger balanced',
      summary: 'Risk cleared, double-entry posted, and final status committed.',
      bannerTone: 'success',
    },
    duplicate: {
      heading: 'Duplicate safely suppressed',
      summary: 'The idempotency key replayed the original response. One payment, one ledger entry.',
      bannerTone: 'info',
    },
    timeout: {
      heading: repaired ? 'Payment recovered · safely approved' : 'Payment timeout · repair required',
      summary: repaired
        ? 'Reconciliation matched the ledger version and finalized the payment without a second write.'
        : 'The ledger is balanced, but the final payment status is unknown.',
      bannerTone: repaired ? 'success' : 'warning',
    },
  }

  return {
    scenario,
    ...scenarioCopy[scenario],
    payments: [selected, ...supportingPayments],
    selectedPaymentId: selected.id,
    reconciliation: scenario === 'timeout'
      ? { ...reconciliation, repaired, result: repaired ? 'status → approved · no duplicate ledger write' : reconciliation.result }
      : null,
  }
}

let current = buildScenario('timeout')

export function resetDemoState(): void {
  current = buildScenario('timeout')
}

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), 260))
}

export const demoApi = {
  async getPayments(): Promise<ScenarioResult> {
    return delay(current)
  },

  async runScenario(scenario: ScenarioName): Promise<ScenarioResult> {
    current = buildScenario(scenario)
    return delay(current)
  },

  async createPayment(input: CreatePaymentInput): Promise<ScenarioResult> {
    const created = payment('pay_9F16', input.recipient, input.amount, {
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      updatedAt: `${BASE_DATE} 10:31:42`,
    })
    current = {
      scenario: 'normal',
      heading: 'Payment approved · ledger balanced',
      summary: 'Risk cleared, double-entry posted, and final status committed.',
      bannerTone: 'success',
      payments: [created, ...current.payments],
      selectedPaymentId: created.id,
      reconciliation: null,
    }
    return delay(current)
  },

  async reconcile(): Promise<ScenarioResult> {
    current = buildScenario('timeout', true)
    return delay(current)
  },
}

export const toneForDecision = (decision: string): Tone => {
  if (decision === 'APPROVED') return 'success'
  if (decision === 'REVIEW') return 'warning'
  if (decision === 'REJECTED' || decision === 'UNKNOWN') return 'danger'
  return 'neutral'
}
