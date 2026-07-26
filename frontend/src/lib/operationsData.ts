import type {
  AddOperationsPaymentInput, AuditEventRecord, JournalRecord, LedgerLineRecord,
  OperationsFixture, OperationsTone, OverviewChartPoint, OverviewRange,
  OverviewSnapshot, PaginatedPayments, PaymentFilters, PaymentRecord,
  PaymentStatus, ReconciliationCaseRecord, ReconciliationEvidenceRecord,
  RiskDecision, RiskEvidenceRecord, StatusDistributionItem,
} from '../operationsTypes'
export type * from '../operationsTypes'

const GENERATED_AT = '2026-07-26T14:30:00.000Z'
const PAYMENT_BASE_TIME = Date.parse('2026-07-26T14:20:00.000Z')
const PAYMENT_INTERVAL_MS = 29 * 60 * 1000
const NEW_PAYMENT_ID_FLOOR = 0x9f15
interface PaymentSeed {
  readonly id: string; readonly recipient: string; readonly amount: number
  readonly status: PaymentStatus; readonly riskDecision: RiskDecision
  readonly currency?: string; readonly processor?: string; readonly paymentMethod?: string
  readonly description?: string; readonly score?: number
  readonly createdAt?: string; readonly updatedAt?: string
}
const PAYMENT_SEEDS: readonly PaymentSeed[] = [
  {
    id: 'pay_8C42', recipient: 'Northstar Supplies', amount: 12_480,
    status: 'Unknown', riskDecision: 'Approved',
    processor: 'ACH Network - timed out',
    paymentMethod: 'ACH', description: 'Warehouse consumables', score: 0.08,
    createdAt: '2026-07-26T14:20:00.000Z',
    updatedAt: '2026-07-26T14:23:14.000Z',
  },
  { id: 'pay_8C31', recipient: 'Harbor Light Freight', amount: 8_420, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_8C1F', recipient: 'Pine & Peak Software', amount: 14_800, status: 'Review', riskDecision: 'Review', paymentMethod: 'Wire', score: 0.72 },
  { id: 'pay_8C08', recipient: 'Redstone Industrial', amount: 56_200, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_8BF4', recipient: 'Auburn Facilities Group', amount: 6_480, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8BDD', recipient: 'Ember Security Works', amount: 18_950, status: 'Rejected', riskDecision: 'Rejected', score: 0.94 },
  { id: 'pay_8BC1', recipient: 'Granite Grove Services', amount: 9_875.25, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_8BA6', recipient: 'Willow Creek Dental', amount: 4_260, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8B91', recipient: 'Summit Office LLC', amount: 3_275.5, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8B73', recipient: 'Clearwater Packaging', amount: 21_640, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_8B5D', recipient: 'Lattice Labs', amount: 31_250, status: 'Review', riskDecision: 'Review', paymentMethod: 'Wire', score: 0.78 },
  { id: 'pay_8B42', recipient: 'Easton Field Services', amount: 7_190, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8B28', recipient: 'Harborstone Foods', amount: 11_825.75, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_8B0D', recipient: 'Meridian Logistics', amount: 8_600, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8AF2', recipient: 'Orion Travel Group', amount: 42_780, status: 'Rejected', riskDecision: 'Rejected', paymentMethod: 'Wire', score: 0.91 },
  { id: 'pay_8AD7', recipient: 'Acorn Data Systems', amount: 16_900, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_8ABC', recipient: 'Juniper Printworks', amount: 2_840.4, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8AA1', recipient: 'Brightwell Media', amount: 24_500, status: 'Review', riskDecision: 'Review', paymentMethod: 'RTP', score: 0.69 },
  { id: 'pay_8A87', recipient: 'Atlas Components', amount: 6_800, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_8A6E', recipient: 'Copperline Electric', amount: 13_725, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8A55', recipient: 'Westbridge Medical', amount: 19_360, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_8A3A', recipient: 'Clearline Consulting', amount: 8_950, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  {
    id: 'pay_8A12', recipient: 'Blue Ridge Partners', amount: 25_000,
    status: 'Approved', riskDecision: 'Approved', paymentMethod: 'ACH',
    description: 'Professional services retainer',
  },
  { id: 'pay_89F8', recipient: 'Cedar & Finch', amount: 5_440, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_89DD', recipient: 'Beacon Street Studio', amount: 17_750, status: 'Review', riskDecision: 'Review', paymentMethod: 'Wire', score: 0.75 },
  { id: 'pay_89C4', recipient: 'Highland Cold Storage', amount: 38_910, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_89A9', recipient: 'Riverbend Textiles', amount: 27_300, status: 'Rejected', riskDecision: 'Rejected', paymentMethod: 'Wire', score: 0.96 },
  { id: 'pay_898F', recipient: 'Sterling Auto Fleet', amount: 15_680, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8974', recipient: 'North Coast Telecom', amount: 10_925, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_895A', recipient: 'Maple Rock Construction', amount: 33_480, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_8941', recipient: 'Silver Pine Hospitality', amount: 7_760.8, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_8927', recipient: 'Fieldstone Energy', amount: 46_200, status: 'Review', riskDecision: 'Review', paymentMethod: 'Wire', score: 0.81 },
  { id: 'pay_890D', recipient: 'Fairview Property Group', amount: 12_340, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_88F3', recipient: 'Moss & Main Retail', amount: 4_980.65, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_88D9', recipient: 'Delta Harbor Labs', amount: 22_175, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
  { id: 'pay_88BF', recipient: 'Kestrel Manufacturing', amount: 64_900, status: 'Rejected', riskDecision: 'Rejected', paymentMethod: 'Wire', score: 0.93 },
  { id: 'pay_88A5', recipient: 'Great Lakes Catering', amount: 6_315, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_888B', recipient: 'Stonegate Legal Services', amount: 18_400, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_8871', recipient: 'Prairie Cloud Hosting', amount: 29_760, status: 'Review', riskDecision: 'Review', paymentMethod: 'Wire', score: 0.77 },
  { id: 'pay_8857', recipient: 'Lakeview Community Health', amount: 9_540, status: 'Approved', riskDecision: 'Approved' },
  { id: 'pay_883D', recipient: 'Everwood Apparel', amount: 14_210, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'RTP' },
  { id: 'pay_8823', recipient: 'Crownline Equipment', amount: 35_875, status: 'Approved', riskDecision: 'Approved', paymentMethod: 'Wire' },
]

const STATUS_TONES: Readonly<Record<PaymentStatus, OperationsTone>> = {
  Approved: 'success',
  Review: 'warning',
  Rejected: 'danger',
  Unknown: 'danger',
}
const PROCESSORS: Readonly<Record<string, string>> = {
  ACH: 'ACH Network',
  RTP: 'The Clearing House',
  Wire: 'Fedwire',
}
function money(amount: number): number {
  return Math.round(amount * 100) / 100
}

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString()
}
function timestampForIndex(index: number): string {
  return new Date(PAYMENT_BASE_TIME - index * PAYMENT_INTERVAL_MS).toISOString()
}

function journalIdFor(paymentId: string): string {
  return `journal_${paymentId.slice(4).toLowerCase()}`
}

function riskEvidenceFor(seed: PaymentSeed, createdAt: string): RiskEvidenceRecord {
  const score = seed.score ?? (seed.riskDecision === 'Approved' ? 0.12 : seed.riskDecision === 'Review' ? 0.72 : 0.93)
  const amountSignal = seed.amount >= 40_000 ? 'Above merchant baseline' : 'Within merchant baseline'

  return {
    decision: seed.riskDecision,
    score,
    policy: 'business_transfer_v4',
    timestamp: addMilliseconds(createdAt, 42_000),
    signals: [
      {
        label: 'Amount profile',
        outcome: amountSignal,
        tone: seed.amount >= 40_000 ? 'warning' : 'success',
      },
      {
        label: 'Recipient tenure',
        outcome: seed.riskDecision === 'Rejected' ? 'First payment' : 'Known counterparty',
        tone: seed.riskDecision === 'Rejected' ? 'warning' : 'success',
      },
      {
        label: 'Velocity limit',
        outcome: seed.riskDecision === 'Review' ? 'Near daily limit' : 'Within daily limit',
        tone: seed.riskDecision === 'Review' ? 'warning' : 'success',
      },
    ],
  }
}

function ledgerLinesFor(seed: PaymentSeed): readonly LedgerLineRecord[] {
  if (seed.status === 'Review' || seed.status === 'Rejected') {
    return []
  }

  const amount = money(seed.amount)
  return [
    { account: 'Vendor expense clearing', side: 'Debit', amount },
    { account: 'Operating cash', side: 'Credit', amount },
  ]
}

function auditFor(
  seed: PaymentSeed,
  createdAt: string,
  journalId: string | null,
): readonly AuditEventRecord[] {
  const received: AuditEventRecord = {
    id: `${seed.id}-received`,
    paymentId: seed.id,
    label: 'Payment received',
    detail: 'Request schema and idempotency key validated',
    timestamp: createdAt,
    state: 'complete',
    actor: 'payment-api',
  }
  const decision: AuditEventRecord = {
    id: `${seed.id}-risk`,
    paymentId: seed.id,
    label: `Risk ${seed.riskDecision.toLowerCase()}`,
    detail: `business_transfer_v4 returned ${seed.riskDecision}`,
    timestamp: addMilliseconds(createdAt, 42_000),
    state: seed.riskDecision === 'Approved' ? 'complete' : 'warning',
    actor: 'risk-engine',
  }

  if (seed.status === 'Rejected') {
    return [
      received,
      decision,
      {
        id: `${seed.id}-rejected`,
        paymentId: seed.id,
        label: 'Payment rejected',
        detail: 'No journal was created',
        timestamp: addMilliseconds(createdAt, 58_000),
        state: 'warning',
        actor: 'payment-orchestrator',
      },
    ]
  }

  if (seed.status === 'Review') {
    return [
      received,
      decision,
      {
        id: `${seed.id}-review`,
        paymentId: seed.id,
        label: 'Manual review queued',
        detail: 'Payment paused before ledger posting',
        timestamp: addMilliseconds(createdAt, 58_000),
        state: 'pending',
        actor: 'review-router',
      },
    ]
  }

  const journalPosted: AuditEventRecord = {
    id: `${seed.id}-journal`,
    paymentId: seed.id,
    label: 'Balanced journal posted',
    detail: `${journalId} committed atomically`,
    timestamp: addMilliseconds(createdAt, 65_000),
    state: 'complete',
    actor: 'ledger-service',
  }

  if (seed.status === 'Unknown') {
    return [
      received,
      decision,
      journalPosted,
      {
        id: `${seed.id}-timeout`,
        paymentId: seed.id,
        label: 'Processor timeout',
        detail: 'No final processor response was received',
        timestamp: addMilliseconds(createdAt, 96_000),
        state: 'warning',
        actor: 'payment-orchestrator',
      },
      {
        id: `${seed.id}-reconciliation`,
        paymentId: seed.id,
        label: 'Reconciliation case opened',
        detail: 'Ledger posted / payment status unknown',
        timestamp: seed.updatedAt ?? addMilliseconds(createdAt, 194_000),
        state: 'pending',
        actor: 'reconciliation-worker',
      },
    ]
  }

  return [
    received,
    decision,
    journalPosted,
    {
      id: `${seed.id}-approved`,
      paymentId: seed.id,
      label: 'Payment approved',
      detail: 'Processor acceptance committed',
      timestamp: addMilliseconds(createdAt, 102_000),
      state: 'complete',
      actor: 'payment-orchestrator',
    },
  ]
}

function paymentFromSeed(seed: PaymentSeed, index: number): PaymentRecord {
  const createdAt = seed.createdAt ?? timestampForIndex(index)
  const updatedAt = seed.updatedAt ?? addMilliseconds(createdAt, 102_000)
  const journalId = seed.status === 'Approved' || seed.status === 'Unknown'
    ? journalIdFor(seed.id)
    : null
  const paymentMethod = seed.paymentMethod ?? 'ACH'
  const ledgerLines = ledgerLinesFor(seed)

  return {
    id: seed.id,
    recipient: seed.recipient,
    merchant: seed.recipient,
    amount: money(seed.amount),
    currency: seed.currency ?? 'USD',
    status: seed.status,
    statusTone: STATUS_TONES[seed.status],
    riskDecision: seed.riskDecision,
    createdAt,
    updatedAt,
    processor: seed.processor ?? PROCESSORS[paymentMethod] ?? 'ACH Network',
    paymentMethod,
    description: seed.description ?? 'Approved vendor invoice',
    idempotencyKey: `idem_${seed.id.slice(4).toLowerCase()}_20260726`,
    version: 3,
    journalId,
    riskEvidence: riskEvidenceFor(seed, createdAt),
    ledgerLines,
    audit: auditFor(seed, createdAt, journalId),
  }
}

function journalFor(payment: PaymentRecord): JournalRecord {
  if (!payment.journalId || payment.ledgerLines.length === 0) {
    throw new Error(`Payment ${payment.id} does not have a journal`)
  }

  const totalDebits = money(payment.ledgerLines
    .filter((line) => line.side === 'Debit')
    .reduce((total, line) => total + line.amount, 0))
  const totalCredits = money(payment.ledgerLines
    .filter((line) => line.side === 'Credit')
    .reduce((total, line) => total + line.amount, 0))

  return {
    id: payment.journalId,
    paymentId: payment.id,
    currency: payment.currency,
    createdAt: addMilliseconds(payment.createdAt, 65_000),
    source: 'payment-engine',
    balanced: totalDebits === totalCredits,
    totalDebits,
    totalCredits,
    lines: payment.ledgerLines.map((line) => ({ ...line })),
  }
}

function reconciliationEvidence(
  caseId: string,
  payment: PaymentRecord,
): readonly ReconciliationEvidenceRecord[] {
  return [
    {
      id: `${caseId}-journal`,
      label: 'Balanced journal located',
      detail: `${payment.journalId} has equal debit and credit totals`,
      recordedAt: addMilliseconds(payment.updatedAt, 30_000),
      tone: 'success',
    },
    {
      id: `${caseId}-cas`,
      label: 'Compare-and-swap guarded',
      detail: `Payment v${payment.version} can be repaired by reusing the existing balanced journal`,
      recordedAt: addMilliseconds(payment.updatedAt, 45_000),
      tone: 'info',
    },
  ]
}

function caseFor(
  payments: readonly PaymentRecord[],
  values: Omit<ReconciliationCaseRecord, 'merchant' | 'journalId' | 'evidence'>,
): ReconciliationCaseRecord {
  const payment = payments.find((candidate) => candidate.id === values.paymentId)
  if (!payment?.journalId) {
    throw new Error(`Reconciliation payment ${values.paymentId} is missing its journal`)
  }

  return {
    ...values,
    merchant: payment.merchant,
    journalId: payment.journalId,
    evidence: reconciliationEvidence(values.id, payment),
  }
}

function buildReconciliationCases(
  payments: readonly PaymentRecord[],
): readonly ReconciliationCaseRecord[] {
  return [
    caseFor(payments, {
      id: 'rec_207',
      paymentId: 'pay_8C42',
      reason: 'Ledger posted / payment status unknown',
      age: '7 min',
      severity: 'Critical',
      state: 'Queued',
      createdAt: '2026-07-26T14:23:14.000Z',
      updatedAt: '2026-07-26T14:24:01.000Z',
      expectedVersion: 3,
      currentVersion: 3,
      repairStrategy: 'Compare-and-swap guarded approval; reuse existing balanced journal',
    }),
    caseFor(payments, {
      id: 'rec_204',
      paymentId: 'pay_8C08',
      reason: 'Processor confirmation arrived after settlement window',
      age: '32 min',
      severity: 'Medium',
      state: 'Investigating',
      createdAt: '2026-07-26T12:58:00.000Z',
      updatedAt: '2026-07-26T13:48:00.000Z',
      expectedVersion: 3,
      currentVersion: 3,
      repairStrategy: 'Verify processor trace before closing exception',
    }),
    caseFor(payments, {
      id: 'rec_198',
      paymentId: 'pay_8A87',
      reason: 'Delayed settlement acknowledgment',
      age: 'Resolved',
      severity: 'Low',
      state: 'Repaired',
      createdAt: '2026-07-26T05:12:00.000Z',
      updatedAt: '2026-07-26T05:24:00.000Z',
      resolvedAt: '2026-07-26T05:24:00.000Z',
      expectedVersion: 3,
      currentVersion: 4,
      repairStrategy: 'Attach late acknowledgment without a ledger write',
    }),
    caseFor(payments, {
      id: 'rec_193',
      paymentId: 'pay_895A',
      reason: 'Duplicate processor trace requires operator confirmation',
      age: '5 hr',
      severity: 'High',
      state: 'Open',
      createdAt: '2026-07-26T02:42:00.000Z',
      updatedAt: '2026-07-26T09:18:00.000Z',
      expectedVersion: 3,
      currentVersion: 3,
      repairStrategy: 'Confirm a single settlement and preserve the original journal',
    }),
    caseFor(payments, {
      id: 'rec_187',
      paymentId: 'pay_888B',
      reason: 'Bank trace normalized after nightly reconciliation',
      age: 'Resolved',
      severity: 'Low',
      state: 'Repaired',
      createdAt: '2026-07-25T19:40:00.000Z',
      updatedAt: '2026-07-25T20:02:00.000Z',
      resolvedAt: '2026-07-25T20:02:00.000Z',
      expectedVersion: 3,
      currentVersion: 3,
      repairStrategy: 'Close with bank trace evidence',
    }),
  ]
}

const CHART_24H: readonly OverviewChartPoint[] = [
  { label: '12a', approved: 3, review: 1, rejected: 0 },
  { label: '3a', approved: 4, review: 0, rejected: 1 },
  { label: '6a', approved: 4, review: 1, rejected: 0 },
  { label: '9a', approved: 3, review: 1, rejected: 1 },
  { label: '12p', approved: 5, review: 1, rejected: 0 },
  { label: '3p', approved: 4, review: 1, rejected: 0 },
  { label: '6p', approved: 4, review: 0, rejected: 1 },
  { label: '9p', approved: 4, review: 1, rejected: 1 },
]

const CHART_7D: readonly OverviewChartPoint[] = [
  { label: 'Mon', approved: 126, review: 8, rejected: 3 },
  { label: 'Tue', approved: 142, review: 11, rejected: 4 },
  { label: 'Wed', approved: 135, review: 7, rejected: 5 },
  { label: 'Thu', approved: 161, review: 12, rejected: 4 },
  { label: 'Fri', approved: 155, review: 9, rejected: 3 },
  { label: 'Sat', approved: 98, review: 6, rejected: 2 },
  { label: 'Sun', approved: 112, review: 8, rejected: 3 },
]

const CHART_30D: readonly OverviewChartPoint[] = [
  { label: 'Jun 27', approved: 612, review: 42, rejected: 15 },
  { label: 'Jul 2', approved: 655, review: 39, rejected: 18 },
  { label: 'Jul 7', approved: 701, review: 48, rejected: 16 },
  { label: 'Jul 12', approved: 684, review: 44, rejected: 21 },
  { label: 'Jul 17', approved: 739, review: 41, rejected: 17 },
  { label: 'Jul 22', approved: 766, review: 46, rejected: 19 },
]

function countStatus(payments: readonly PaymentRecord[], status: PaymentStatus): number {
  return payments.filter((payment) => payment.status === status).length
}

function approvalRate(payments: readonly PaymentRecord[]): number {
  if (payments.length === 0) return 0
  return Math.round((countStatus(payments, 'Approved') / payments.length) * 1_000) / 10
}

function unresolvedCaseCount(cases: readonly ReconciliationCaseRecord[]): number {
  return cases.filter((item) => item.state !== 'Repaired').length
}

function buildOverview(
  payments: readonly PaymentRecord[],
  cases: readonly ReconciliationCaseRecord[],
): Readonly<Record<OverviewRange, OverviewSnapshot>> {
  const paymentVolume = money(payments.reduce((total, payment) => total + payment.amount, 0))
  const reviewCount = countStatus(payments, 'Review')
  const exceptionCount = unresolvedCaseCount(cases)

  return {
    '24h': {
      range: '24h',
      label: 'Last 24 hours',
      kpis: {
        paymentVolume,
        paymentVolumeDelta: 8.4,
        approvalRate: approvalRate(payments),
        approvalRateDelta: 1.2,
        manualReview: reviewCount,
        manualReviewDelta: -2,
        reconciliationExceptions: exceptionCount,
        reconciliationExceptionsDelta: -1,
      },
      chartPoints: CHART_24H.map((point) => ({ ...point })),
    },
    '7d': {
      range: '7d',
      label: 'Last 7 days',
      kpis: {
        paymentVolume: 4_842_315.2,
        paymentVolumeDelta: 12.6,
        approvalRate: 93.7,
        approvalRateDelta: 0.8,
        manualReview: 61,
        manualReviewDelta: -7,
        reconciliationExceptions: 14,
        reconciliationExceptionsDelta: -3,
      },
      chartPoints: CHART_7D.map((point) => ({ ...point })),
    },
    '30d': {
      range: '30d',
      label: 'Last 30 days',
      kpis: {
        paymentVolume: 19_675_440.75,
        paymentVolumeDelta: 17.3,
        approvalRate: 94.1,
        approvalRateDelta: 1.5,
        manualReview: 260,
        manualReviewDelta: -18,
        reconciliationExceptions: 53,
        reconciliationExceptionsDelta: -11,
      },
      chartPoints: CHART_30D.map((point) => ({ ...point })),
    },
  }
}

function buildStatusDistribution(
  payments: readonly PaymentRecord[],
): readonly StatusDistributionItem[] {
  return (['Approved', 'Review', 'Rejected', 'Unknown'] as const).map((status) => ({
    label: status,
    count: countStatus(payments, status),
    tone: STATUS_TONES[status],
  }))
}

function nextFixtureTimestamp(fixture: OperationsFixture): string {
  return addMilliseconds(fixture.generatedAt, 60_000)
}

function updateLatestChartPoint(
  points: readonly OverviewChartPoint[],
): readonly OverviewChartPoint[] {
  return points.map((point, index) => index === points.length - 1
    ? { ...point, approved: point.approved + 1 }
    : { ...point })
}

function overviewWithAddedPayment(
  fixture: OperationsFixture,
  amount: number,
  payments: readonly PaymentRecord[],
): Readonly<Record<OverviewRange, OverviewSnapshot>> {
  const update = (snapshot: OverviewSnapshot): OverviewSnapshot => ({
    ...snapshot,
    kpis: {
      ...snapshot.kpis,
      paymentVolume: money(snapshot.kpis.paymentVolume + amount),
      approvalRate: snapshot.range === '24h'
        ? approvalRate(payments)
        : snapshot.kpis.approvalRate,
    },
    chartPoints: updateLatestChartPoint(snapshot.chartPoints),
  })

  return {
    '24h': update(fixture.overview['24h']),
    '7d': update(fixture.overview['7d']),
    '30d': update(fixture.overview['30d']),
  }
}

function overviewWithRepair(
  fixture: OperationsFixture,
  payments: readonly PaymentRecord[],
  cases: readonly ReconciliationCaseRecord[],
): Readonly<Record<OverviewRange, OverviewSnapshot>> {
  const repairedExceptionCount = unresolvedCaseCount(fixture.reconciliationCases)
    - unresolvedCaseCount(cases)
  const addedApproval = countStatus(payments, 'Approved') - countStatus(fixture.payments, 'Approved')
  const update = (snapshot: OverviewSnapshot): OverviewSnapshot => ({
    ...snapshot,
    kpis: {
      ...snapshot.kpis,
      approvalRate: snapshot.range === '24h'
        ? approvalRate(payments)
        : snapshot.kpis.approvalRate,
      reconciliationExceptions: Math.max(
        0,
        snapshot.kpis.reconciliationExceptions - repairedExceptionCount,
      ),
    },
    chartPoints: addedApproval > 0 ? updateLatestChartPoint(snapshot.chartPoints) : snapshot.chartPoints.map((point) => ({ ...point })),
  })

  return {
    '24h': update(fixture.overview['24h']),
    '7d': update(fixture.overview['7d']),
    '30d': update(fixture.overview['30d']),
  }
}

export function createOperationsFixture(): OperationsFixture {
  const payments = PAYMENT_SEEDS.map(paymentFromSeed)
  const journals = payments.flatMap((payment) => payment.journalId ? [journalFor(payment)] : [])
  const reconciliationCases = buildReconciliationCases(payments)

  return {
    generatedAt: GENERATED_AT,
    payments,
    journals,
    reconciliationCases,
    auditEvents: payments.flatMap((payment) => payment.audit.map((event) => ({ ...event }))),
    overview: buildOverview(payments, reconciliationCases),
    statusDistribution: buildStatusDistribution(payments),
    riskSignals: [
      { label: 'Unusual amount', count: 11, trend: 8, tone: 'warning' },
      { label: 'New recipient', count: 7, trend: -3, tone: 'info' },
      { label: 'Velocity threshold', count: 5, trend: -12, tone: 'success' },
      { label: 'Recipient watchlist', count: 2, trend: 0, tone: 'danger' },
    ],
  }
}

function normalizedFilter(value: string): string {
  return value.trim().toLowerCase()
}

export function filterPayments(
  payments: readonly PaymentRecord[],
  filters: PaymentFilters,
): readonly PaymentRecord[] {
  const query = normalizedFilter(filters.query)
  const status = normalizedFilter(filters.status)
  const risk = normalizedFilter(filters.risk)

  return payments.filter((payment) => {
    const searchText = [
      payment.id,
      payment.recipient,
      payment.merchant,
      payment.amount.toString(),
      payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      payment.currency,
      payment.status,
      payment.riskDecision,
      payment.processor,
      payment.paymentMethod,
      payment.description,
      payment.idempotencyKey,
    ].join(' ').toLowerCase()

    const matchesQuery = query.length === 0 || searchText.includes(query)
    const matchesStatus = status === 'all' || payment.status.toLowerCase() === status
    const matchesRisk = risk === 'all' || payment.riskDecision.toLowerCase() === risk
    return matchesQuery && matchesStatus && matchesRisk
  })
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer`)
  }
  return value
}

export function paginatePayments(
  payments: readonly PaymentRecord[],
  page: number,
  pageSize: number,
): PaginatedPayments {
  const requestedPage = positiveInteger(page, 'page')
  const normalizedPageSize = positiveInteger(pageSize, 'pageSize')
  const total = payments.length
  const pageCount = Math.ceil(total / normalizedPageSize)
  const normalizedPage = pageCount === 0 ? 1 : Math.min(requestedPage, pageCount)
  const offset = (normalizedPage - 1) * normalizedPageSize
  const items = payments.slice(offset, offset + normalizedPageSize)

  return {
    items,
    total,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    pageCount,
    start: items.length === 0 ? 0 : offset + 1,
    end: items.length === 0 ? 0 : offset + items.length,
  }
}

function nextPaymentId(payments: readonly PaymentRecord[]): string {
  const highestId = payments.reduce((highest, payment) => {
    const parsed = Number.parseInt(payment.id.slice(4), 16)
    return Number.isNaN(parsed) ? highest : Math.max(highest, parsed)
  }, NEW_PAYMENT_ID_FLOOR)
  return `pay_${(highestId + 1).toString(16).toUpperCase().padStart(4, '0')}`
}

export function addOperationsPayment(
  fixture: OperationsFixture,
  input: AddOperationsPaymentInput,
): OperationsFixture {
  const recipient = input.recipient.trim()
  if (!recipient) {
    throw new Error('recipient is required')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new RangeError('amount must be greater than zero')
  }

  const createdAt = nextFixtureTimestamp(fixture)
  const newPayment = paymentFromSeed({
    id: nextPaymentId(fixture.payments),
    recipient,
    amount: money(input.amount),
    status: 'Approved',
    riskDecision: 'Approved',
    description: 'Operator-created vendor payment',
    createdAt,
    updatedAt: addMilliseconds(createdAt, 102_000),
  }, 0)
  const payments = [newPayment, ...fixture.payments]

  return {
    ...fixture,
    generatedAt: newPayment.updatedAt,
    payments,
    journals: [journalFor(newPayment), ...fixture.journals],
    auditEvents: [...newPayment.audit, ...fixture.auditEvents],
    overview: overviewWithAddedPayment(fixture, newPayment.amount, payments),
    statusDistribution: buildStatusDistribution(payments),
  }
}

export function repairReconciliationCase(
  fixture: OperationsFixture,
  caseId: string,
): OperationsFixture {
  const target = fixture.reconciliationCases.find((item) => item.id === caseId)
  if (!target) throw new Error(`Reconciliation case ${caseId} was not found`)
  if (target.state === 'Repaired') return fixture

  const payment = fixture.payments.find((item) => item.id === target.paymentId)
  const journal = fixture.journals.find((item) => item.id === target.journalId)
  if (!payment) throw new Error(`Payment ${target.paymentId} was not found`)
  if (!journal?.balanced) throw new Error(`Balanced journal ${target.journalId} is required for repair`)
  if (target.currentVersion !== target.expectedVersion) {
    throw new Error(`Stale reconciliation case ${target.id}: expected v${target.expectedVersion}, found v${target.currentVersion}`)
  }
  if (payment.version !== target.expectedVersion) {
    throw new Error(`Stale payment version for ${payment.id}: expected v${target.expectedVersion}, found v${payment.version}`)
  }

  const repairedAt = nextFixtureTimestamp(fixture)
  const auditEvidence: AuditEventRecord = {
    id: `${target.id}-repair`,
    paymentId: payment.id,
    label: 'Safe repair approved',
    detail: `Compare-and-swap matched v${payment.version}; reused ${journal.id}. No new ledger entries created`,
    timestamp: repairedAt,
    state: 'complete',
    actor: 'operator:maya-chen',
  }
  const caseEvidence: ReconciliationEvidenceRecord = {
    id: `${target.id}-complete`,
    label: 'Repair completed',
    detail: 'No new ledger entries created; the existing balanced journal was reused',
    recordedAt: repairedAt,
    tone: 'success',
  }
  const payments = fixture.payments.map((item) => item.id === payment.id
    ? {
        ...item,
        status: 'Approved' as const,
        statusTone: 'success' as const,
        updatedAt: repairedAt,
        version: item.version + 1,
        audit: [...item.audit, auditEvidence],
      }
    : item)
  const reconciliationCases = fixture.reconciliationCases.map((item) => item.id === target.id
    ? {
        ...item,
        age: 'Resolved',
        state: 'Repaired' as const,
        updatedAt: repairedAt,
        resolvedAt: repairedAt,
        currentVersion: payment.version + 1,
        evidence: [...item.evidence, caseEvidence],
      }
    : item)

  return {
    ...fixture,
    generatedAt: repairedAt,
    payments,
    journals: fixture.journals,
    reconciliationCases,
    auditEvents: [...fixture.auditEvents, auditEvidence],
    overview: overviewWithRepair(fixture, payments, reconciliationCases),
    statusDistribution: buildStatusDistribution(payments),
  }
}
