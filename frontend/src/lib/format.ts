/**
 * Presentation helpers.
 *
 * Money arrives as integer minor units and is never converted to a float before it is
 * formatted — the division happens inside Intl, once, at the edge.
 */

const currencyFormatters = new Map<string, Intl.NumberFormat>()

function currencyFormatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: compact ? 0 : 2,
    })
    currencyFormatters.set(key, formatter)
  }
  return formatter
}

export function formatMoney(amountMinor: number, currency = 'USD'): string {
  return currencyFormatter(currency, false).format(amountMinor / 100)
}

export function formatMoneyCompact(amountMinor: number, currency = 'USD'): string {
  return currencyFormatter(currency, true).format(amountMinor / 100)
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatMetric(value: number, unit: string, currency = 'USD'): string {
  if (unit === 'currency') return formatMoneyCompact(value, currency)
  if (unit === 'percent') return formatPercent(value)
  return formatCount(value)
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatFullTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

/** "4 min ago" beats a timestamp when the reader only cares how stale something is. */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  return formatDuration(Math.max(0, (now - new Date(iso).getTime()) / 1000)) + ' ago'
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`
  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} hr`
  const days = hours / 24
  return `${Math.round(days)} ${Math.round(days) === 1 ? 'day' : 'days'}`
}

export function titleCase(value: string): string {
  if (!value) return value
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
