import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'clearledger.theme'

function readStored(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    // Private windows and blocked site data both throw here; the default is fine.
    return 'system'
  }
}

/**
 * Light, dark, or follow the OS. "System" stamps no attribute at all so the page keeps
 * responding to `prefers-color-scheme` live, rather than freezing whatever it was at load.
 */
export function useTheme(): {
  theme: ThemePreference
  setTheme: (next: ThemePreference) => void
  cycle: () => void
} {
  const [theme, setThemeState] = useState<ThemePreference>(readStored)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Preference is a convenience; failing to persist it must not break the page.
    }
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), [])
  const cycle = useCallback(
    () =>
      setThemeState((current) =>
        current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system',
      ),
    [],
  )

  return { theme, setTheme, cycle }
}
