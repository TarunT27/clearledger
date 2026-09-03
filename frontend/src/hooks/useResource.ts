import { useCallback, useEffect, useRef, useState } from 'react'

export interface Resource<T> {
  readonly data: T | null
  readonly error: string | null
  /** True only on the first load; a refresh keeps the previous data on screen. */
  readonly loading: boolean
  readonly refreshing: boolean
  readonly reload: () => void
}

/**
 * Fetches one thing and keeps it fresh.
 *
 * A reload deliberately keeps the previous value visible and sets `refreshing` instead of
 * clearing to a spinner — a table that empties itself every few seconds is unreadable, and
 * an operator watching a number needs it to stay put while the next value arrives.
 * In-flight requests are aborted when the inputs change, so a slow response cannot land
 * after a newer one.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { readonly pollMs?: number } = {},
): Resource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nonce, setNonce] = useState(0)
  const hasData = useRef(false)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    if (hasData.current) setRefreshing(true)
    else setLoading(true)

    loadRef
      .current(controller.signal)
      .then((result) => {
        if (cancelled) return
        hasData.current = true
        setData(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof DOMException && cause.name === 'AbortError')) return
        setError(cause instanceof Error ? cause.message : 'The request failed.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  const pollMs = options.pollMs
  useEffect(() => {
    if (!pollMs) return
    const timer = window.setInterval(reload, pollMs)
    return () => window.clearInterval(timer)
  }, [pollMs, reload])

  return { data, error, loading, refreshing, reload }
}

/** Delays a fast-changing value so a search box does not fire a request per keystroke. */
export function useDebounced<T>(value: T, delayMs = 260): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
