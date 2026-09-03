import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CircleDashed,
  Inbox,
  Loader2,
  Minus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react'
import {
  formatCount,
  formatMetric,
  formatMoney,
  formatPercent,
  initialsOf,
} from '../lib/format'
import type {
  Counterparty,
  Metric as MetricData,
  PaymentStatus,
  RiskDecision,
  Tone,
} from '../lib/consoleTypes'

/* ------------------------------------------------------------------ status */

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  APPROVED: 'success',
  REVIEW: 'warning',
  REJECTED: 'danger',
  PENDING: 'neutral',
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  APPROVED: 'Approved',
  REVIEW: 'Review',
  REJECTED: 'Rejected',
  PENDING: 'Pending',
}

export function StatusPill({
  status,
  label,
}: {
  readonly status: PaymentStatus | RiskDecision
  readonly label?: string
}) {
  const tone = STATUS_TONE[status as PaymentStatus] ?? 'neutral'
  return (
    <span className={`pill pill--${tone}`}>
      <span className="pill__dot" aria-hidden="true" />
      {label ?? STATUS_LABEL[status as PaymentStatus] ?? status}
    </span>
  )
}

export function TonePill({ tone, children }: { readonly tone: Tone; readonly children: ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>
}

const SEVERITY_TONE: Record<string, Tone> = {
  Critical: 'danger',
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
}

export function SeverityPill({ severity }: { readonly severity: string }) {
  return <TonePill tone={SEVERITY_TONE[severity] ?? 'neutral'}>{severity}</TonePill>
}

/* ------------------------------------------------------------------ party */

export function Party({
  party,
  meta,
}: {
  readonly party: Counterparty
  readonly meta?: string
}) {
  return (
    <div className="party">
      <span className="avatar" aria-hidden="true">
        {initialsOf(party.displayName)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="party__name">{party.displayName}</div>
        <div className="party__meta">{meta ?? `${party.reference} · ${party.country}`}</div>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- metric */

export function MetricCard({
  metric,
  currency = 'USD',
}: {
  readonly metric: MetricData
  readonly currency?: string
}) {
  const delta = metric.deltaPercent
  const direction = delta === null ? 'flat' : delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat'
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  // Colour follows whether the movement is good, not whether the number went up: fewer
  // payments waiting on an analyst is an improvement even though the arrow points down.
  const sentiment =
    direction === 'flat'
      ? 'flat'
      : (direction === 'up') === metric.preferHigher
        ? 'up'
        : 'down'

  return (
    <div className="metric">
      <span className="metric__label">{metric.label}</span>
      <span className="metric__value">
        {formatMetric(metric.value, metric.unit, currency)}
      </span>
      <span className="metric__foot">
        {delta === null ? null : (
          <span className={`delta delta--${sentiment}`}>
            <Icon size={13} aria-hidden="true" />
            {formatPercent(Math.abs(delta), 1)}
          </span>
        )}
        <span>{metric.caption}</span>
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ money */

export function Money({
  amountMinor,
  currency,
}: {
  readonly amountMinor: number
  readonly currency: string
}) {
  return <span className="tnum">{formatMoney(amountMinor, currency)}</span>
}

/* ------------------------------------------------------------ segmented */

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: string
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  readonly options: readonly SegmentedOption<T>[]
  readonly value: T
  readonly onChange: (next: T) => void
  readonly label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- searchbox */

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly placeholder: string
  readonly label: string
}) {
  const id = useId()
  return (
    <div className="search">
      <Search size={15} className="search__icon" aria-hidden="true" />
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        className="search__input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="search__clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/* ---------------------------------------------------------- placeholders */

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  readonly title: string
  readonly body: string
  readonly icon?: ReactNode
  readonly action?: ReactNode
}) {
  return (
    <div className="placeholder">
      <span className="placeholder__icon">{icon ?? <Inbox size={20} aria-hidden="true" />}</span>
      <span className="placeholder__title">{title}</span>
      <p className="placeholder__body">{body}</p>
      {action}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  readonly message: string
  readonly onRetry?: () => void
}) {
  return (
    <div className="placeholder" role="alert">
      <span className="placeholder__icon" style={{ color: 'var(--red)' }}>
        <AlertTriangle size={20} aria-hidden="true" />
      </span>
      <span className="placeholder__title">Could not load this view</span>
      <p className="placeholder__body">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}

export function LoadingRows({
  rows = 6,
  height = 44,
}: {
  readonly rows?: number
  readonly height?: number
}) {
  return (
    <div className="stack stack--tight" aria-hidden="true" style={{ padding: 'var(--space-4)' }}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height }} />
      ))}
    </div>
  )
}

export function Spinner({ label }: { readonly label: string }) {
  return (
    <span className="row text-tertiary text-caption">
      <Loader2 size={13} className="spin" aria-hidden="true" />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ meter */

export function Meter({
  label,
  value,
  total,
  color,
  trailing,
}: {
  readonly label: string
  readonly value: number
  readonly total: number
  readonly color: string
  readonly trailing?: ReactNode
}) {
  const share = total === 0 ? 0 : (value / total) * 100
  return (
    <div className="meter">
      <div className="meter__head">
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span className="tnum text-secondary">
          {trailing ?? (
            <>
              {formatCount(value)} <span className="text-tertiary">{formatPercent(share, 0)}</span>
            </>
          )}
        </span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={Math.round(share)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="meter__fill" style={{ width: `${share}%`, background: color }} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ sheet */

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  readonly title: ReactNode
  readonly subtitle?: ReactNode
  readonly onClose: () => void
  readonly children: ReactNode
  readonly footer?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    panel.current?.focus()
    // Lock the page behind the sheet: without this the wheel scrolls the list underneath
    // and closing the sheet leaves the reader somewhere they never navigated to.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={panel}
      >
        <header className="sheet__header">
          <div className="stack stack--tight" style={{ minWidth: 0 }}>
            <h2 id={titleId} className="card__title">
              {title}
            </h2>
            {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            aria-label="Close details"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer ? <div className="card__footer">{footer}</div> : null}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ toast */

export interface ToastMessage {
  readonly id: number
  readonly text: string
  readonly tone: 'success' | 'error'
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  readonly toasts: readonly ToastMessage[]
  readonly onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role="status">
          <span className="toast__icon">
            {toast.tone === 'success' ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <AlertTriangle size={16} aria-hidden="true" />
            )}
          </span>
          <span className="toast__text">{toast.text}</span>
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- fragments */

export function Pagination({
  page,
  totalPages,
  totalItems,
  onChange,
  noun,
}: {
  readonly page: number
  readonly totalPages: number
  readonly totalItems: number
  readonly onChange: (next: number) => void
  readonly noun: string
}) {
  return (
    <>
      <span>
        {formatCount(totalItems)} {noun}
        {totalItems === 1 ? '' : 's'}
      </span>
      <div className="row">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={page <= 0}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <span className="tnum text-tertiary">
          Page {page + 1} of {Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={page + 1 >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  )
}

export function DotIndicator({ state }: { readonly state: 'online' | 'offline' | 'pending' }) {
  return <span className="status-line__dot" data-state={state} aria-hidden="true" />
}

export { CircleDashed }

export function PageHeader({
  eyebrow,
  title,
  lede,
  tools,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly lede: string
  readonly tools?: ReactNode
}) {
  return (
    <header className="page__head">
      <div className="page__heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page__title">{title}</h1>
        <p className="page__lede">{lede}</p>
      </div>
      {tools ? <div className="page__tools">{tools}</div> : null}
    </header>
  )
}

export function RefreshButton({
  onClick,
  busy,
}: {
  readonly onClick: () => void
  readonly busy: boolean
}) {
  return (
    <button type="button" className="btn btn--secondary" onClick={onClick} disabled={busy}>
      <RefreshCw size={14} className={busy ? 'spin' : undefined} aria-hidden="true" />
      Refresh
    </button>
  )
}
