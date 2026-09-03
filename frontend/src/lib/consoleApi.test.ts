import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleApiError, consoleApi, newIdempotencyKey } from './consoleApi'
import { mockFetch, overview, page, paymentRow } from '../test/fixtures'

describe('console API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/console/overview': overview }))
  })

  it('unwraps the success envelope', async () => {
    const report = await consoleApi.overview('7d')
    expect(report.rangeLabel).toBe('Last 7 days')
  })

  it('omits empty and false query parameters instead of sending noise', async () => {
    const fetchMock = mockFetch({ '/console/payments': page([paymentRow()]) })
    vi.stubGlobal('fetch', fetchMock)

    await consoleApi.payments({ query: '', status: 'APPROVED', exceptionsOnly: false, page: 2 })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('status=APPROVED')
    expect(url).toContain('page=2')
    expect(url).not.toContain('query=')
    expect(url).not.toContain('exceptionsOnly')
  })

  it('surfaces the server error code and message, not a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              data: null,
              error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Key reused with a different body.' },
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    )

    await expect(consoleApi.payment('abc')).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409,
      message: 'Key reused with a different body.',
    })
  })

  it('reports an unreachable API distinctly from an API that answered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const failure = await consoleApi.reconciliation().catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ConsoleApiError)
    expect((failure as ConsoleApiError).code).toBe('NETWORK_UNREACHABLE')
    expect((failure as ConsoleApiError).status).toBe(0)
  })

  it('sends the idempotency key as a header when creating a payment', async () => {
    const fetchMock = mockFetch({ '/payments': paymentRow() })
    vi.stubGlobal('fetch', fetchMock)

    await consoleApi.createPayment({
      senderId: 'a',
      recipientId: 'b',
      amountMinor: 25_000,
      currency: 'USD',
      description: 'Invoice',
      idempotencyKey: 'console-fixed-key',
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('console-fixed-key')
    expect(JSON.parse(String(init.body))).toMatchObject({ amountMinor: 25_000 })
  })

  it('generates a distinct key per attempt so a retry is never a silent replay', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey())
    expect(newIdempotencyKey('scenario')).toMatch(/^scenario-/)
  })
})
