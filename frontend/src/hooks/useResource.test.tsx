import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDebounced, useResource } from './useResource'

function Probe({ load, input }: { readonly load: (signal: AbortSignal) => Promise<string>; readonly input?: string }) {
  const { data, error, loading, refreshing, reload } = useResource(load, [input])
  return (
    <div>
      <span data-testid="state">
        {loading ? 'loading' : refreshing ? 'refreshing' : error ? `error:${error}` : data}
      </span>
      <button type="button" onClick={reload}>
        reload
      </button>
    </div>
  )
}

describe('useResource', () => {
  it('keeps the previous value on screen while a reload is in flight', async () => {
    let resolveSecond: ((value: string) => void) | undefined
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockResolvedValueOnce('first')
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)))

    render(<Probe load={load} />)
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('first'))

    await act(async () => {
      screen.getByRole('button', { name: 'reload' }).click()
    })
    expect(screen.getByTestId('state')).toHaveTextContent('refreshing')

    await act(async () => {
      resolveSecond?.('second')
    })
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('second'))
  })

  it('reports the failure message rather than an empty view', async () => {
    const load = vi.fn(async () => {
      throw new Error('Cannot reach the ClearLedger API.')
    })
    render(<Probe load={load} />)
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('error:Cannot reach the ClearLedger API.'),
    )
  })

  it('aborts the in-flight request when its inputs change', async () => {
    const seen: AbortSignal[] = []
    const load = vi.fn(async (signal: AbortSignal) => {
      seen.push(signal)
      return 'value'
    })

    const view = render(<Probe load={load} input="a" />)
    await waitFor(() => expect(seen.length).toBeGreaterThan(0))
    view.rerender(<Probe load={load} input="b" />)

    await waitFor(() => expect(seen[0].aborted).toBe(true))
  })

  it('swallows an abort instead of rendering it as a failure', async () => {
    const load = vi.fn(async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    render(<Probe load={load} />)
    await waitFor(() => expect(screen.getByTestId('state')).not.toHaveTextContent('error:'))
  })
})

function DebounceProbe({ value }: { readonly value: string }) {
  return <span data-testid="debounced">{useDebounced(value, 200)}</span>
}

describe('useDebounced', () => {
  it('holds a fast-changing value until it settles', async () => {
    vi.useFakeTimers()
    try {
      const view = render(<DebounceProbe value="a" />)
      view.rerender(<DebounceProbe value="ab" />)
      view.rerender(<DebounceProbe value="abc" />)
      expect(screen.getByTestId('debounced')).toHaveTextContent('a')

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      expect(screen.getByTestId('debounced')).toHaveTextContent('abc')
    } finally {
      vi.useRealTimers()
    }
  })
})
