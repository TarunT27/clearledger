/**
 * Wire types for `/api/v1/console/*`.
 *
 * These mirror the Java records on the read side one-for-one. They are deliberately not
 * reshaped on arrival: when a field is missing here the console shows nothing rather than
 * inventing a plausible value, which is the property that separates this build from a
 * mocked dashboard.
 */

export type PaymentStatus = 'APPROVED' | 'REVIEW' | 'REJECTED' | 'PENDING'
export type RiskDecision = 'APPROVED' | 'REVIEW' | 'REJECTED'
export type EntryDirection = 'DEBIT' | 'CREDIT'
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type RangeId = '24h' | '7d' | '30d'
export type ReconciliationAction =
  | 'FINALIZE_APPROVED'
  | 'FINALIZE_DECISION'
  | 'FLAG_MANUAL_REVIEW'
  | 'NO_OP'

export interface ApiEnvelope<T> {
  readonly success: boolean
  readonly data: T
  readonly error: { readonly code: string; readonly message: string; readonly details?: unknown } | null
  readonly meta?: Record<string, unknown> | null
}

export interface Counterparty {
  readonly id: string
  readonly displayName: string
  readonly legalName: string
  readonly reference: string
  readonly category: string
  readonly country: string
  readonly role: 'SENDER' | 'RECIPIENT'
}

export interface PaymentRow {
  readonly id: string
  readonly reference: string
  readonly sender: Counterparty
  readonly recipient: Counterparty
  readonly amountMinor: number
  readonly currency: string
  readonly description: string
  readonly status: PaymentStatus
  readonly riskDecision: RiskDecision
  readonly riskScore: number
  readonly riskSignals: readonly string[]
  readonly journalPosted: boolean
  readonly journalId: string | null
  readonly reconciliationRequired: boolean
  readonly version: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RiskSignalDetail {
  readonly code: string
  readonly label: string
  readonly explanation: string
  readonly score: number
  readonly triggered: boolean
}

export interface JournalLine {
  readonly accountId: string
  readonly accountLabel: string
  readonly direction: EntryDirection
  readonly amountMinor: number
  readonly currency: string
}

export interface JournalView {
  readonly id: string
  readonly reference: string
  readonly paymentId: string
  readonly paymentReference: string | null
  readonly counterpartyName: string | null
  readonly createdAt: string
  readonly currency: string
  readonly totalDebitsMinor: number
  readonly totalCreditsMinor: number
  readonly balanced: boolean
  readonly matchesPayment: boolean
  readonly lines: readonly JournalLine[]
}

export interface AuditEventView {
  readonly id: string
  readonly paymentId: string | null
  readonly paymentReference: string | null
  readonly eventType: string
  readonly label: string
  readonly actor: string
  readonly detail: string
  readonly tone: Tone
  readonly createdAt: string
}

export interface PaymentDetail {
  readonly payment: PaymentRow
  readonly riskSignals: readonly RiskSignalDetail[]
  readonly journal: JournalView | null
  readonly audit: readonly AuditEventView[]
}

export interface ConsolePage<T> {
  readonly items: readonly T[]
  readonly page: number
  readonly size: number
  readonly totalItems: number
  readonly totalPages: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean
}

export interface Metric {
  readonly key: string
  readonly label: string
  readonly unit: 'currency' | 'percent' | 'count'
  readonly value: number
  readonly previousValue: number
  readonly deltaPercent: number | null
  /** Whether a rise is an improvement; falling manual review is good news. */
  readonly preferHigher: boolean
  readonly caption: string
}

export interface ThroughputBucket {
  readonly startsAt: string
  readonly label: string
  readonly approved: number
  readonly review: number
  readonly rejected: number
  readonly pending: number
  readonly volumeMinor: number
}

export interface DecisionSlice {
  readonly key: PaymentStatus
  readonly label: string
  readonly count: number
  readonly share: number
}

export interface SignalActivity {
  readonly code: string
  readonly label: string
  readonly count: number
  readonly previousCount: number
  readonly share: number
}

export interface LedgerHealth {
  readonly journals: number
  readonly balancedJournals: number
  readonly postedVolumeMinor: number
  readonly currency: string
  readonly lastPostedAt: string | null
}

export interface OverviewReport {
  readonly range: RangeId
  readonly rangeLabel: string
  readonly generatedAt: string
  readonly windowStart: string
  readonly metrics: readonly Metric[]
  readonly throughput: readonly ThroughputBucket[]
  readonly decisionMix: readonly DecisionSlice[]
  readonly signalActivity: readonly SignalActivity[]
  readonly exceptions: readonly PaymentRow[]
  readonly ledgerHealth: LedgerHealth
}

export interface RiskPolicy {
  readonly unusualAmountMinor: number
  readonly repeatedAttemptLimit: number
  readonly velocityLimitMinor: number
  readonly reviewScoreThreshold: number
  readonly attemptWindowMinutes: number
  readonly velocityWindowMinutes: number
}

export interface RiskReport {
  readonly range: RangeId
  readonly rangeLabel: string
  readonly assessedPayments: number
  readonly averageScore: number
  readonly signals: readonly SignalActivity[]
  readonly decisionMix: readonly DecisionSlice[]
  readonly reviewQueue: readonly PaymentRow[]
  readonly rejectedQueue: readonly PaymentRow[]
  readonly policy: RiskPolicy
}

export interface ReconciliationRun {
  readonly id: string
  readonly startedAt: string
  readonly completedAt: string
  readonly scanned: number
  readonly repaired: number
  readonly flagged: number
  readonly trigger: 'SCHEDULED' | 'MANUAL' | 'TARGETED'
}

export interface ReconciliationCase {
  readonly paymentId: string
  readonly reference: string
  readonly sender: Counterparty
  readonly recipient: Counterparty
  readonly amountMinor: number
  readonly currency: string
  readonly severity: 'Critical' | 'High' | 'Medium' | 'Low'
  readonly reason: string
  readonly detectedAt: string
  readonly ageSeconds: number
  readonly journalPosted: boolean
  readonly balanced: boolean
  readonly matchesPayment: boolean
  readonly version: number
  readonly plannedAction: ReconciliationAction
  readonly repairStrategy: string
  readonly journal: JournalView | null
  readonly evidence: readonly AuditEventView[]
}

export interface ReconciliationStats {
  readonly openCases: number
  readonly journalBackedCases: number
  readonly casesWithoutJournal: number
  readonly repairableNow: number
  readonly lastRunAt: string | null
  readonly repairedAllTime: number
  readonly flaggedAllTime: number
  readonly workerEnabled: boolean
  readonly workerIntervalMs: number
}

export interface ReconciliationBoard {
  readonly cases: readonly ReconciliationCase[]
  readonly runs: readonly ReconciliationRun[]
  readonly stats: ReconciliationStats
  readonly generatedAt: string
}

export interface RepairOutcome {
  readonly paymentId: string
  readonly action: ReconciliationAction
  readonly status: PaymentStatus
  readonly observedVersion: number
  readonly committedVersion: number
  readonly alreadyResolved: boolean
  readonly narrative: string
}

export interface PaymentQuery {
  readonly query?: string
  readonly status?: PaymentStatus
  readonly risk?: RiskDecision
  readonly signal?: string
  readonly exceptionsOnly?: boolean
  readonly sort?: string
  readonly direction?: 'ASC' | 'DESC'
  readonly page?: number
  readonly size?: number
}

export interface CreatePaymentInput {
  readonly senderId: string
  readonly recipientId: string
  readonly amountMinor: number
  readonly currency: string
  readonly description: string
  readonly idempotencyKey: string
}

export interface ScenarioResult {
  readonly scenario: string
  readonly narrative: string
  readonly before: unknown
  readonly after: unknown
  readonly duplicateDetected: boolean
  readonly timeline: readonly string[]
}
