export type OperationsTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export type PaymentStatus = 'Approved' | 'Review' | 'Rejected' | 'Unknown'
export type RiskDecision = PaymentStatus
export type OverviewRange = '24h' | '7d' | '30d'
export type JournalSide = 'Debit' | 'Credit'
export type AuditEventState = 'complete' | 'warning' | 'pending'
export type ReconciliationSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type ReconciliationState = 'Open' | 'Investigating' | 'Queued' | 'Repaired'

export interface RiskSignalRecord {
  readonly label: string
  readonly outcome: string
  readonly tone: OperationsTone
}

export interface RiskEvidenceRecord {
  readonly decision: RiskDecision
  readonly score: number
  readonly policy: string
  readonly signals: readonly RiskSignalRecord[]
  readonly timestamp: string
}

export interface LedgerLineRecord {
  readonly account: string
  readonly side: JournalSide
  readonly amount: number
}

export interface AuditEventRecord {
  readonly id: string
  readonly paymentId: string
  readonly label: string
  readonly detail: string
  readonly timestamp: string
  readonly state: AuditEventState
  readonly actor: string
}

export interface PaymentRecord {
  readonly id: string
  readonly recipient: string
  readonly merchant: string
  readonly amount: number
  readonly currency: string
  readonly status: PaymentStatus
  readonly statusTone: OperationsTone
  readonly riskDecision: RiskDecision
  readonly createdAt: string
  readonly updatedAt: string
  readonly processor: string
  readonly paymentMethod: string
  readonly description: string
  readonly idempotencyKey: string
  readonly version: number
  readonly journalId: string | null
  readonly riskEvidence: RiskEvidenceRecord
  readonly ledgerLines: readonly LedgerLineRecord[]
  readonly audit: readonly AuditEventRecord[]
}

export interface JournalRecord {
  readonly id: string
  readonly paymentId: string
  readonly currency: string
  readonly createdAt: string
  readonly source: string
  readonly balanced: boolean
  readonly totalDebits: number
  readonly totalCredits: number
  readonly lines: readonly LedgerLineRecord[]
}

export interface ReconciliationEvidenceRecord {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly recordedAt: string
  readonly tone: OperationsTone
}

export interface ReconciliationCaseRecord {
  readonly id: string
  readonly paymentId: string
  readonly merchant: string
  readonly reason: string
  readonly age: string
  readonly severity: ReconciliationSeverity
  readonly state: ReconciliationState
  readonly createdAt: string
  readonly updatedAt: string
  readonly journalId: string
  readonly expectedVersion: number
  readonly currentVersion: number
  readonly repairStrategy: string
  readonly evidence: readonly ReconciliationEvidenceRecord[]
  readonly resolvedAt?: string
}

export interface OverviewKpis {
  readonly paymentVolume: number
  readonly paymentVolumeDelta: number
  readonly approvalRate: number
  readonly approvalRateDelta: number
  readonly manualReview: number
  readonly manualReviewDelta: number
  readonly reconciliationExceptions: number
  readonly reconciliationExceptionsDelta: number
}

export interface OverviewChartPoint {
  readonly label: string
  readonly approved: number
  readonly review: number
  readonly rejected: number
}

export interface OverviewSnapshot {
  readonly range: OverviewRange
  readonly label: string
  readonly kpis: OverviewKpis
  readonly chartPoints: readonly OverviewChartPoint[]
}

export interface StatusDistributionItem {
  readonly label: PaymentStatus
  readonly count: number
  readonly tone: OperationsTone
}

export interface RiskSignalSummary {
  readonly label: string
  readonly count: number
  readonly trend: number
  readonly tone: OperationsTone
}

export interface OperationsFixture {
  readonly generatedAt: string
  readonly payments: readonly PaymentRecord[]
  readonly journals: readonly JournalRecord[]
  readonly reconciliationCases: readonly ReconciliationCaseRecord[]
  readonly auditEvents: readonly AuditEventRecord[]
  readonly overview: Readonly<Record<OverviewRange, OverviewSnapshot>>
  readonly statusDistribution: readonly StatusDistributionItem[]
  readonly riskSignals: readonly RiskSignalSummary[]
}

export type PaymentFilterStatus =
  | 'all'
  | PaymentStatus
  | 'approved'
  | 'review'
  | 'rejected'
  | 'unknown'

export type PaymentFilterRisk =
  | 'all'
  | RiskDecision
  | 'approved'
  | 'review'
  | 'rejected'
  | 'unknown'

export interface PaymentFilters {
  readonly query: string
  readonly status: PaymentFilterStatus
  readonly risk: PaymentFilterRisk
}

export interface PaginatedPayments {
  readonly items: readonly PaymentRecord[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly pageCount: number
  readonly start: number
  readonly end: number
}

export interface AddOperationsPaymentInput {
  readonly amount: number
  readonly recipient: string
}
