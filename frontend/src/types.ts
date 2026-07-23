export type ScenarioName = 'normal' | 'duplicate' | 'timeout'
export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'
export type PaymentState = 'APPROVED' | 'REVIEW' | 'REJECTED' | 'UNKNOWN'

export interface RiskSignal {
  readonly label: string
  readonly outcome: string
  readonly tone: Tone
}

export interface RiskEvidence {
  readonly decision: PaymentState
  readonly score: number
  readonly policy: string
  readonly signals: readonly RiskSignal[]
  readonly timestamp: string
}

export interface LedgerLine {
  readonly account: string
  readonly side: 'Debit' | 'Credit'
  readonly amount: number
}

export interface AuditEvent {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly timestamp: string
  readonly state: 'complete' | 'warning' | 'pending'
}

export interface Payment {
  readonly id: string
  readonly recipient: string
  readonly amount: number
  readonly currency: string
  readonly risk: string
  readonly ledger: string
  readonly processor: string
  readonly status: string
  readonly statusTone: Tone
  readonly updatedAt: string
  readonly idempotencyKey: string
  readonly version: number
  readonly riskEvidence: RiskEvidence
  readonly ledgerLines: readonly LedgerLine[]
  readonly audit: readonly AuditEvent[]
}

export interface Reconciliation {
  readonly runId: string
  readonly mismatch: string
  readonly expectedVersion: number
  readonly currentVersion: number
  readonly repair: string
  readonly result: string
  readonly repaired: boolean
}

export interface ScenarioResult {
  readonly scenario: ScenarioName
  readonly heading: string
  readonly summary: string
  readonly bannerTone: Tone
  readonly payments: readonly Payment[]
  readonly selectedPaymentId: string
  readonly reconciliation: Reconciliation | null
}

export interface CreatePaymentInput {
  readonly amount: number
  readonly currency: string
  readonly recipient: string
  readonly idempotencyKey: string
}
