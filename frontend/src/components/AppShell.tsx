import {
  Bell,
  BookOpen,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  CreditCard,
  Grid2X2,
  Menu,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Brand } from './Brand'

const navItems = [
  { label: 'Overview', icon: Grid2X2, active: false },
  { label: 'Payments', icon: CreditCard, active: true },
  { label: 'Ledger', icon: BookOpen, active: false },
  { label: 'Risk', icon: ShieldCheck, active: false },
  { label: 'Reconciliation', icon: RefreshCw, active: false },
  { label: 'Audit log', icon: ClipboardList, active: false },
] as const

export function AppShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <Brand />
        </div>
        <div className="topbar__context">
          <span className="environment-badge">Production</span>
          <span className="topbar__divider" aria-hidden="true" />
          <span className="topbar__title">Payment Operations</span>
        </div>
        <label className="global-search">
          <span className="sr-only">Search payments</span>
          <CircleGauge size={16} aria-hidden="true" />
          <input type="search" placeholder="Search payments, recipients, IDs…" />
        </label>
        <div className="system-health">
          <span className="system-health__dot" aria-hidden="true" />
          <span>All systems operational</span>
        </div>
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell size={19} />
        </button>
        <button className="profile-button" type="button" aria-label="Open account menu">
          <span>AO</span>
          <ChevronDown size={15} />
        </button>
      </header>

      <aside className="nav-rail" aria-label="Primary navigation">
        <nav>
          {navItems.map(({ label, icon: Icon, active }) => (
            <a
              key={label}
              href={`#${label.toLowerCase().replace(' ', '-')}`}
              className={`nav-item${active ? ' nav-item--active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <button className="nav-collapse" type="button">
          <Menu size={18} />
          <span>Collapse</span>
        </button>
      </aside>

      <main className="workspace">{children}</main>
    </div>
  )
}
