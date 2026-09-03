import {
  BookOpen,
  ClipboardList,
  CreditCard,
  FlaskConical,
  LayoutGrid,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { SearchField } from './primitives'

export type ViewId =
  | 'overview'
  | 'payments'
  | 'ledger'
  | 'risk'
  | 'reconciliation'
  | 'audit-log'
  | 'scenario-lab'

interface NavEntry {
  readonly id: ViewId
  readonly label: string
  readonly icon: typeof LayoutGrid
  readonly group: 'Operations' | 'Assurance'
}

const NAV: readonly NavEntry[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'Operations' },
  { id: 'payments', label: 'Payments', icon: CreditCard, group: 'Operations' },
  { id: 'ledger', label: 'Ledger', icon: BookOpen, group: 'Operations' },
  { id: 'risk', label: 'Risk', icon: ShieldCheck, group: 'Assurance' },
  { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw, group: 'Assurance' },
  { id: 'audit-log', label: 'Audit log', icon: ClipboardList, group: 'Assurance' },
  { id: 'scenario-lab', label: 'Scenario lab', icon: FlaskConical, group: 'Assurance' },
]

export interface AppShellProps {
  readonly activeView: ViewId
  readonly children: ReactNode
  readonly onNavigate: (view: ViewId) => void
  readonly onGlobalSearch: (query: string) => void
  readonly environmentLabel: string
  readonly connection: 'online' | 'offline' | 'pending'
  readonly openExceptions: number
  readonly toolbarActions?: ReactNode
}

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }
const THEME_LABEL = {
  system: 'Appearance: match system',
  light: 'Appearance: light',
  dark: 'Appearance: dark',
}

export function AppShell({
  activeView,
  children,
  onNavigate,
  onGlobalSearch,
  environmentLabel,
  connection,
  openExceptions,
  toolbarActions,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const { theme, cycle } = useTheme()
  const ThemeIcon = THEME_ICON[theme]

  const activeLabel = NAV.find((entry) => entry.id === activeView)?.label ?? 'Operations'
  const groups = ['Operations', 'Assurance'] as const
  const connectionLabel =
    connection === 'online'
      ? 'API connected'
      : connection === 'pending'
        ? 'Connecting…'
        : 'API unreachable'

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onGlobalSearch(query.trim())
  }

  return (
    <div className="shell" data-collapsed={collapsed}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/assets/clearledger-mark.png" alt="" className="sidebar__mark" />
          <span className="sidebar__wordmark">
            <span className="sidebar__name">ClearLedger</span>
            <span className="sidebar__env">{environmentLabel}</span>
          </span>
        </div>

        {groups.map((group) => (
          <nav key={group} className="sidebar__nav" aria-label={group}>
            <div className="sidebar__section">{group}</div>
            {NAV.filter((entry) => entry.group === group).map((entry) => {
              const Icon = entry.icon
              const isActive = entry.id === activeView
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="nav-item"
                  aria-current={isActive ? 'page' : undefined}
                  // The visible label is hidden when the sidebar collapses and on narrow
                  // screens; naming the button explicitly keeps it reachable by screen
                  // readers and by name in tests at every width.
                  aria-label={entry.label}
                  title={entry.label}
                  onClick={() => onNavigate(entry.id)}
                >
                  <span className="nav-item__icon">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="nav-item__label">{entry.label}</span>
                  {entry.id === 'reconciliation' && openExceptions > 0 ? (
                    <span className="nav-item__badge">{openExceptions}</span>
                  ) : null}
                </button>
              )
            })}
          </nav>
        ))}

        <div className="sidebar__spacer" />

        <div className="sidebar__foot">
          <button
            type="button"
            className="nav-item"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="nav-item__icon">
              {collapsed ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={16} aria-hidden="true" />
              )}
            </span>
            <span className="nav-item__label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>

      <div className="content">
        <header className="toolbar">
          <span className="toolbar__title">{activeLabel}</span>
          <form className="toolbar__search" onSubmit={submitSearch} role="search">
            <SearchField
              value={query}
              onChange={setQuery}
              label="Search payments"
              placeholder="Search payments, references, counterparties…"
            />
          </form>
          <div className="toolbar__actions">
            {toolbarActions}
            {/*
              Reachability lives in the toolbar rather than the sidebar because it is the
              one piece of status that matters at every width, and the sidebar collapses to
              icons on a phone. The label stays on the element even when the text is hidden,
              so it is announced and testable regardless of viewport.
            */}
            <span className="status-line" role="status" aria-label={connectionLabel}>
              <span className="status-line__dot" data-state={connection} aria-hidden="true" />
              <span className="status-line__text">{connectionLabel}</span>
            </span>
            <button
              type="button"
              className="btn btn--quiet btn--icon"
              onClick={cycle}
              title={THEME_LABEL[theme]}
              aria-label={THEME_LABEL[theme]}
            >
              <ThemeIcon size={16} aria-hidden="true" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
