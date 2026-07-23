import { buildScenario, demoApi, toneForDecision } from './demoApi'
import type { CreatePaymentInput, Payment, PaymentState, ScenarioName, ScenarioResult } from '../types'

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.MODE === 'test'

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new ApiError('ClearLedger could not complete the operation.', response.status)
  }

  const body = await response.json() as T | { data: T }
  return typeof body === 'object' && body !== null && 'data' in body ? body.data : body
}

interface BackendPayment {
  readonly id?: string
  readonly recipientId?: string
  readonly amountMinor?: number
  readonly currency?: string
  readonly status?: string
  readonly riskDecision?: string
  readonly riskScore?: number
  readonly riskSignals?: readonly string[]
  readonly updatedAt?: string
}

interface BackendScenario {
  readonly before?: BackendPayment
  readonly after?: BackendPayment
  readonly duplicateDetected?: boolean
}

export function recipientIdFor(label: string): string {
  let hash = 0x811c9dc5
  for (const character of label.trim().toLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const hex = Array.from({ length: 8 }, (_, index) =>
    ((hash + Math.imul(index + 1, 0x9e3779b1)) >>> 0).toString(16).padStart(8, '0'),
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function normalizeBackendPayment(source: BackendPayment, fallback: Payment): Payment {
  const decision = (source.riskDecision ?? fallback.riskEvidence.decision) as PaymentState
  const amount = typeof source.amountMinor === 'number' ? source.amountMinor / 100 : fallback.amount
  const status = source.status
    ? source.status.charAt(0) + source.status.slice(1).toLowerCase()
    : fallback.status
  return {
    ...fallback,
    id: source.id ?? fallback.id,
    recipient: fallback.recipient,
    amount,
    currency: source.currency ?? fallback.currency,
    status,
    statusTone: toneForDecision(source.status ?? decision),
    updatedAt: source.updatedAt
      ? new Date(source.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' })
      : fallback.updatedAt,
    risk: decision.charAt(0) + decision.slice(1).toLowerCase(),
    riskEvidence: {
      ...fallback.riskEvidence,
      decision,
      score: source.riskScore ?? fallback.riskEvidence.score,
      signals: source.riskSignals?.map((signal, index) => ({
        label: `Risk signal ${index + 1}`,
        outcome: signal,
        tone: 'warning' as const,
      })) ?? fallback.riskEvidence.signals,
    },
    ledgerLines: fallback.ledgerLines.map((line) => ({ ...line, amount })),
  }
}

function withBackendPayment(base: ScenarioResult, source?: BackendPayment): ScenarioResult {
  if (!source) return base
  const selected = normalizeBackendPayment(source, base.payments[0])
  return {
    ...base,
    selectedPaymentId: selected.id,
    payments: [selected, ...base.payments.slice(1)],
  }
}

export const api = {
  getPayments: async (): Promise<ScenarioResult> => {
    if (DEMO_MODE) return demoApi.getPayments()
    try {
      const response = await request<BackendScenario>(
        '/api/v1/demo/scenarios/timeout',
        { method: 'POST' },
      )
      return withBackendPayment(buildScenario('timeout'), response.before)
    } catch (error) {
      if (!(error instanceof ApiError) || ![401, 403, 404].includes(error.status)) {
        throw error
      }
    }
    const payments = await request<readonly BackendPayment[]>('/api/v1/payments?size=5')
    const base = buildScenario('normal')
    if (payments.length === 0) return base
    const normalized = payments.map((payment, index) =>
      normalizeBackendPayment(payment, base.payments[index] ?? base.payments[0]))
    return {
      ...base,
      payments: normalized,
      selectedPaymentId: normalized[0].id,
    }
  },

  runScenario: async (scenario: ScenarioName): Promise<ScenarioResult> => {
    if (DEMO_MODE) return demoApi.runScenario(scenario)
    const response = await request<BackendScenario>(
      `/api/v1/demo/scenarios/${scenario}`,
      { method: 'POST' },
    )
    const payment = scenario === 'timeout' ? response.before : response.after
    return withBackendPayment(buildScenario(scenario), payment)
  },

  createPayment: async (input: CreatePaymentInput): Promise<ScenarioResult> => {
    if (DEMO_MODE) return demoApi.createPayment(input)
    const payment = await request<BackendPayment>('/api/v1/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify({
        senderId: '10000000-0000-0000-0000-000000000001',
        recipientId: recipientIdFor(input.recipient),
        amountMinor: Math.round(input.amount * 100),
        currency: input.currency,
        description: 'Payment Operations console',
      }),
    })
    const base = buildScenario('normal')
    const selected = { ...base.payments[0], recipient: input.recipient }
    return withBackendPayment({ ...base, payments: [selected, ...base.payments.slice(1)] }, payment)
  },

  reconcile: async (): Promise<ScenarioResult> => {
    if (DEMO_MODE) return demoApi.reconcile()
    await request('/api/v1/reconciliation/runs', {
      method: 'POST',
      headers: { 'X-ClearLedger-Request': 'ClearLedgerConsole' },
    })
    return buildScenario('timeout', true)
  },
}
