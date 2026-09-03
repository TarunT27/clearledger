import type {
  ApiEnvelope,
  AuditEventView,
  ConsolePage,
  Counterparty,
  CreatePaymentInput,
  JournalView,
  OverviewReport,
  PaymentDetail,
  PaymentQuery,
  PaymentRow,
  ReconciliationBoard,
  RepairOutcome,
  RiskReport,
  ScenarioResult,
} from './consoleTypes'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

export class ConsoleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = 'REQUEST_FAILED',
  ) {
    super(message)
    this.name = 'ConsoleApiError'
  }
}

interface RequestOptions {
  readonly method?: string
  readonly body?: unknown
  readonly headers?: Record<string, string>
  readonly signal?: AbortSignal
}

/**
 * One place where an HTTP response becomes either data or a typed error.
 *
 * The API always answers in an envelope, so a failure carries the server's own message and
 * code; the console shows those instead of a generic "something went wrong", which is what
 * makes a failed request diagnosable from the screen alone.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ConsoleApiError(
      'Cannot reach the ClearLedger API. Is the service running?',
      0,
      'NETWORK_UNREACHABLE',
    )
  }

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null

  if (!response.ok) {
    throw new ConsoleApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
    )
  }
  if (payload === null) {
    throw new ConsoleApiError('The API returned an empty response.', response.status)
  }
  return payload.data
}

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

/** Unique per attempt, so a retried submission is a new payment and a replay is not. */
export function newIdempotencyKey(prefix = 'console'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}-${random}`
}

export const consoleApi = {
  overview: (range: string, signal?: AbortSignal) =>
    request<OverviewReport>(`/console/overview?range=${encodeURIComponent(range)}`, { signal }),

  payments: (query: PaymentQuery, signal?: AbortSignal) =>
    request<ConsolePage<PaymentRow>>(
      `/console/payments${queryString({
        query: query.query,
        status: query.status,
        risk: query.risk,
        signal: query.signal,
        exceptionsOnly: query.exceptionsOnly,
        sort: query.sort,
        direction: query.direction,
        page: query.page,
        size: query.size,
      })}`,
      { signal },
    ),

  payment: (paymentId: string, signal?: AbortSignal) =>
    request<PaymentDetail>(`/console/payments/${paymentId}`, { signal }),

  journals: (query: string, page: number, size: number, signal?: AbortSignal) =>
    request<ConsolePage<JournalView>>(
      `/console/journals${queryString({ query, page, size })}`,
      { signal },
    ),

  auditEvents: (
    query: string,
    eventType: string,
    page: number,
    size: number,
    signal?: AbortSignal,
  ) =>
    request<ConsolePage<AuditEventView>>(
      `/console/audit-events${queryString({ query, eventType, page, size })}`,
      { signal },
    ),

  risk: (range: string, signal?: AbortSignal) =>
    request<RiskReport>(`/console/risk?range=${encodeURIComponent(range)}`, { signal }),

  reconciliation: (signal?: AbortSignal) =>
    request<ReconciliationBoard>('/console/reconciliation', { signal }),

  repair: (paymentId: string) =>
    request<RepairOutcome>(`/console/reconciliation/cases/${paymentId}/repair`, {
      method: 'POST',
    }),

  counterparties: (role: 'SENDER' | 'RECIPIENT', signal?: AbortSignal) =>
    request<readonly Counterparty[]>(`/console/counterparties?role=${role}`, { signal }),

  /**
   * Creates a payment through the production endpoint rather than a console-only shortcut,
   * so the browser exercises the same idempotency-key contract an integrator would.
   */
  createPayment: (input: CreatePaymentInput) =>
    request<PaymentRow>('/payments', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: {
        senderId: input.senderId,
        recipientId: input.recipientId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        description: input.description,
      },
    }),

  runScenario: (scenario: 'normal' | 'duplicate' | 'timeout') =>
    request<ScenarioResult>(`/demo/scenarios/${scenario}`, { method: 'POST' }),

  runReconciliation: () =>
    request<unknown>('/reconciliation/runs', {
      method: 'POST',
      headers: { 'X-ClearLedger-Request': 'ClearLedgerConsole' },
    }),
}

export type ConsoleApi = typeof consoleApi
