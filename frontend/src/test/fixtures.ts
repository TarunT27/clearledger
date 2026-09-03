import { vi } from 'vitest'
import type {
  AuditEventView,
  ConsolePage,
  Counterparty,
  JournalView,
  OverviewReport,
  PaymentDetail,
  PaymentRow,
  ReconciliationBoard,
  RepairOutcome,
  RiskReport,
} from '../lib/consoleTypes'

export const senderParty: Counterparty = {
  id: '10000000-0000-0000-0000-000000000001',
  displayName: 'Atlas Operating',
  legalName: 'Atlas Operating Company LLC',
  reference: 'CL-SND-0001',
  category: 'Operating account',
  country: 'US',
  role: 'SENDER',
}

export const recipientParty: Counterparty = {
  id: '20000000-0000-0000-0000-000000000001',
  displayName: 'Northstar Supplies',
  legalName: 'Northstar Supplies Corporation',
  reference: 'CL-RCP-0001',
  category: 'Supplier',
  country: 'US',
  role: 'RECIPIENT',
}

export function paymentRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'e1f2a3b4-0000-4000-8000-000000000001',
    reference: 'PAY-E1F20001',
    sender: senderParty,
    recipient: recipientParty,
    amountMinor: 25_000,
    currency: 'USD',
    description: 'Invoice CL-1001',
    status: 'APPROVED',
    riskDecision: 'APPROVED',
    riskScore: 0,
    riskSignals: [],
    journalPosted: true,
    journalId: 'aaaaaaaa-0000-4000-8000-000000000001',
    reconciliationRequired: false,
    version: 1,
    createdAt: '2026-09-03T10:00:00Z',
    updatedAt: '2026-09-03T10:00:01Z',
    ...overrides,
  }
}

export const journal: JournalView = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  reference: 'JRN-AAAA0001',
  paymentId: 'e1f2a3b4-0000-4000-8000-000000000001',
  paymentReference: 'PAY-E1F20001',
  counterpartyName: 'Northstar Supplies',
  createdAt: '2026-09-03T10:00:00Z',
  currency: 'USD',
  totalDebitsMinor: 25_000,
  totalCreditsMinor: 25_000,
  balanced: true,
  matchesPayment: true,
  lines: [
    {
      accountId: 'CUSTOMER:10000000-0000-0000-0000-000000000001',
      accountLabel: 'Atlas Operating',
      direction: 'DEBIT',
      amountMinor: 25_000,
      currency: 'USD',
    },
    {
      accountId: 'CUSTOMER:20000000-0000-0000-0000-000000000001',
      accountLabel: 'Northstar Supplies',
      direction: 'CREDIT',
      amountMinor: 25_000,
      currency: 'USD',
    },
  ],
}

export const auditEvent: AuditEventView = {
  id: 'bbbbbbbb-0000-4000-8000-000000000001',
  paymentId: 'e1f2a3b4-0000-4000-8000-000000000001',
  paymentReference: 'PAY-E1F20001',
  eventType: 'JOURNAL_POSTED',
  label: 'Journal posted',
  actor: 'LEDGER',
  detail: 'Balanced debit and credit entries committed.',
  tone: 'success',
  createdAt: '2026-09-03T10:00:00Z',
}

export const paymentDetail: PaymentDetail = {
  payment: paymentRow(),
  riskSignals: [
    {
      code: 'UNUSUAL_AMOUNT',
      label: 'Unusual amount',
      explanation: 'Amount meets or exceeds the unusual-payment threshold.',
      score: 0,
      triggered: false,
    },
    {
      code: 'NEW_RECIPIENT',
      label: 'New recipient',
      explanation: 'No earlier approved payment to this recipient was found.',
      score: 40,
      triggered: true,
    },
  ],
  journal,
  audit: [auditEvent],
}

export const overview: OverviewReport = {
  range: '7d',
  rangeLabel: 'Last 7 days',
  generatedAt: '2026-09-03T12:00:00Z',
  windowStart: '2026-08-27T00:00:00Z',
  metrics: [
    {
      key: 'processedVolume',
      label: 'Processed volume',
      unit: 'currency',
      value: 22_230_000,
      previousValue: 19_500_000,
      deltaPercent: 13.8,
      preferHigher: true,
      caption: '72 payments',
    },
    {
      key: 'manualReview',
      label: 'Manual review',
      unit: 'count',
      value: 16,
      previousValue: 13,
      deltaPercent: 23.1,
      preferHigher: false,
      caption: 'Waiting on an analyst',
    },
    {
      key: 'openExceptions',
      label: 'Open exceptions',
      unit: 'count',
      value: 2,
      previousValue: 2,
      deltaPercent: null,
      preferHigher: false,
      caption: 'Pending payments awaiting reconciliation',
    },
  ],
  throughput: [
    {
      startsAt: '2026-09-02T00:00:00Z',
      label: 'Wed',
      approved: 8,
      review: 2,
      rejected: 0,
      pending: 0,
      volumeMinor: 900_000,
    },
    {
      startsAt: '2026-09-03T00:00:00Z',
      label: 'Thu',
      approved: 5,
      review: 1,
      rejected: 0,
      pending: 2,
      volumeMinor: 640_000,
    },
  ],
  decisionMix: [
    { key: 'APPROVED', label: 'Approved', count: 13, share: 72.2 },
    { key: 'REVIEW', label: 'Review', count: 3, share: 16.7 },
    { key: 'REJECTED', label: 'Rejected', count: 0, share: 0 },
    { key: 'PENDING', label: 'Pending', count: 2, share: 11.1 },
  ],
  signalActivity: [
    { code: 'NEW_RECIPIENT', label: 'New recipient', count: 12, previousCount: 8, share: 60 },
    { code: 'UNUSUAL_AMOUNT', label: 'Unusual amount', count: 4, previousCount: 4, share: 20 },
  ],
  exceptions: [
    paymentRow({
      id: 'e1f2a3b4-0000-4000-8000-000000000002',
      reference: 'PAY-E1F20002',
      status: 'PENDING',
      journalPosted: true,
      reconciliationRequired: true,
    }),
  ],
  ledgerHealth: {
    journals: 181,
    balancedJournals: 181,
    postedVolumeMinor: 37_464_909,
    currency: 'USD',
    lastPostedAt: '2026-09-03T11:35:00Z',
  },
}

export const riskReport: RiskReport = {
  range: '7d',
  rangeLabel: 'Last 7 days',
  assessedPayments: 72,
  averageScore: 11.9,
  signals: overview.signalActivity,
  decisionMix: overview.decisionMix,
  reviewQueue: [paymentRow({ status: 'REVIEW', riskScore: 40, riskSignals: ['NEW_RECIPIENT'] })],
  rejectedQueue: [],
  policy: {
    unusualAmountMinor: 1_000_000,
    repeatedAttemptLimit: 3,
    velocityLimitMinor: 2_500_000,
    reviewScoreThreshold: 40,
    attemptWindowMinutes: 10,
    velocityWindowMinutes: 60,
  },
}

export const reconciliationBoard: ReconciliationBoard = {
  generatedAt: '2026-09-03T12:00:00Z',
  cases: [
    {
      paymentId: 'e1f2a3b4-0000-4000-8000-000000000002',
      reference: 'PAY-E1F20002',
      sender: senderParty,
      recipient: recipientParty,
      amountMinor: 167_500,
      currency: 'USD',
      severity: 'Medium',
      reason: 'Ledger posted, final status never observed.',
      detectedAt: '2026-09-03T10:42:00Z',
      ageSeconds: 4_800,
      journalPosted: true,
      balanced: true,
      matchesPayment: true,
      version: 1,
      plannedAction: 'FINALIZE_APPROVED',
      repairStrategy:
        'Verify the committed journal, then compare-and-swap the pending row to APPROVED.',
      journal,
      evidence: [auditEvent],
    },
  ],
  runs: [
    {
      id: 'cccccccc-0000-4000-8000-000000000001',
      startedAt: '2026-09-03T11:44:00Z',
      completedAt: '2026-09-03T11:44:00Z',
      scanned: 1,
      repaired: 1,
      flagged: 0,
      trigger: 'TARGETED',
    },
  ],
  stats: {
    openCases: 1,
    journalBackedCases: 1,
    casesWithoutJournal: 0,
    repairableNow: 1,
    lastRunAt: '2026-09-03T11:44:00Z',
    repairedAllTime: 1,
    flaggedAllTime: 0,
    workerEnabled: false,
    workerIntervalMs: 30_000,
  },
}

export const repairOutcome: RepairOutcome = {
  paymentId: 'e1f2a3b4-0000-4000-8000-000000000002',
  action: 'FINALIZE_APPROVED',
  status: 'APPROVED',
  observedVersion: 1,
  committedVersion: 2,
  alreadyResolved: false,
  narrative:
    'Existing journal verified as balanced and matching; status finalized without a second journal.',
}

export function page<T>(items: readonly T[]): ConsolePage<T> {
  return {
    items,
    page: 0,
    size: 20,
    totalItems: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  }
}

export interface RouteTable {
  readonly [pattern: string]: unknown
}

/**
 * Routes fetch calls to canned envelopes by URL substring.
 *
 * Tests assert against the same wire shapes the Java records serialize, so a field renamed
 * on the server breaks a test rather than silently rendering blanks in production.
 */
export function mockFetch(routes: RouteTable, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init
    const url = typeof input === 'string' ? input : input.toString()
    const match = Object.keys(routes).find((pattern) => url.includes(pattern))
    if (!match) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'NOT_STUBBED', message: `No stub for ${url}` },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response(
      JSON.stringify({ success: status < 400, data: routes[match], error: null }),
      { status, headers: { 'Content-Type': 'application/json' } },
    )
  })
}
