import {
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  CircleGauge,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FlaskConical,
  Grid2X2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import '../styles/shell.css'
import { Brand } from './Brand'

export type ViewId =
  | 'overview'
  | 'payments'
  | 'ledger'
  | 'risk'
  | 'reconciliation'
  | 'audit-log'
  | 'scenario-lab'

export interface AppShellProps {
  readonly activeView: ViewId
  readonly children: ReactNode
  readonly onGlobalSearch: (query: string) => void
  readonly environmentLabel?: string
}

const navItems: ReadonlyArray<{
  readonly id: ViewId
  readonly label: string
  readonly icon: typeof Grid2X2
}> = [
  { id: 'overview', label: 'Overview', icon: Grid2X2 },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'ledger', label: 'Ledger', icon: BookOpen },
  { id: 'risk', label: 'Risk', icon: ShieldCheck },
  { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw },
  { id: 'audit-log', label: 'Audit log', icon: ClipboardList },
  { id: 'scenario-lab', label: 'Scenario lab', icon: FlaskConical },
]

interface NotificationItem {
  readonly id: 'reconciliation-ready' | 'risk-review' | 'ledger-close'
  readonly title: string
  readonly detail: string
  readonly time: string
  readonly read: boolean
}

const initialNotifications: ReadonlyArray<NotificationItem> = [
  {
    id: 'reconciliation-ready',
    title: 'Reconciliation case ready',
    detail: 'A timed-out payment is ready for a compare-and-swap guarded repair.',
    time: '4 min ago',
    read: false,
  },
  {
    id: 'risk-review',
    title: 'Risk review assigned',
    detail: 'Payment pay_8A12 moved to analyst review after a velocity check.',
    time: '18 min ago',
    read: false,
  },
  {
    id: 'ledger-close',
    title: 'Ledger close completed',
    detail: 'The 14:00 UTC posting window closed with all journals balanced.',
    time: '42 min ago',
    read: false,
  },
]

export function AppShell({
  activeView,
  children,
  onGlobalSearch,
  environmentLabel = 'Local environment',
}: AppShellProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<ReadonlyArray<NotificationItem>>(
    initialNotifications,
  )
  const [compactNavigation, setCompactNavigation] = useState(false)
  const [isHelpVisible, setIsHelpVisible] = useState(false)

  const navigationId = useId()
  const notificationDialogId = useId()
  const notificationTitleId = useId()
  const accountMenuId = useId()
  const notificationButtonRef = useRef<HTMLButtonElement>(null)
  const notificationDialogRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  )
  const activeViewLabel =
    navItems.find((item) => item.id === activeView)?.label ?? 'Operations'

  useEffect(() => {
    if (isNotificationsOpen) {
      notificationDialogRef.current?.focus()
    }
  }, [isNotificationsOpen])

  useEffect(() => {
    if (isAccountMenuOpen) {
      accountMenuRef.current?.focus()
    }
  }, [isAccountMenuOpen])

  function submitGlobalSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onGlobalSearch(searchQuery.trim())
  }

  function toggleNotifications() {
    setIsAccountMenuOpen(false)
    setIsNotificationsOpen((isOpen) => !isOpen)
  }

  function closeNotifications({ restoreFocus = true } = {}) {
    setIsNotificationsOpen(false)
    if (restoreFocus) {
      notificationButtonRef.current?.focus()
    }
  }

  function markNotificationRead(notificationId: NotificationItem['id']) {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification,
      ),
    )
  }

  function markAllNotificationsRead() {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({ ...notification, read: true })),
    )
  }

  function toggleAccountMenu() {
    setIsNotificationsOpen(false)
    setIsAccountMenuOpen((isOpen) => !isOpen)
  }

  function closeAccountMenu() {
    setIsAccountMenuOpen(false)
    setIsHelpVisible(false)
    accountButtonRef.current?.focus()
  }

  function closeOnEscape(
    event: KeyboardEvent<HTMLElement>,
    close: () => void,
  ) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  }

  return (
    <div
      className={[
        'app-shell',
        'ops-shell',
        isCollapsed ? 'ops-shell--collapsed' : '',
        compactNavigation ? 'ops-shell--compact' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="ops-shell__header">
        <div className="ops-shell__brand">
          <Brand />
        </div>

        <div className="ops-shell__context" aria-label="Workspace context">
          <span className="ops-shell__environment">{environmentLabel}</span>
          <span className="ops-shell__context-divider" aria-hidden="true" />
          <span className="ops-shell__view-title">{activeViewLabel}</span>
        </div>

        <form
          className="ops-shell__search"
          role="search"
          aria-label="Global search"
          onSubmit={submitGlobalSearch}
        >
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            maxLength={120}
            aria-label="Global search"
            placeholder="Search payments, recipients, IDs…"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button type="submit" aria-label="Submit global search">
            Search
          </button>
        </form>

        <div className="ops-shell__health" role="status">
          <CircleGauge size={16} aria-hidden="true" />
          <span>Operations dataset ready</span>
        </div>

        <div className="ops-shell__actions">
          <div className="ops-shell__notification-trigger">
            <button
              ref={notificationButtonRef}
              className="ops-shell__icon-button"
              type="button"
              aria-label="Notifications"
              aria-haspopup="dialog"
              aria-expanded={isNotificationsOpen}
              aria-controls={notificationDialogId}
              onClick={toggleNotifications}
            >
              <Bell size={19} aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="ops-shell__notification-count" aria-hidden="true">
                  {unreadCount}
                </span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div
                ref={notificationDialogRef}
                id={notificationDialogId}
                className="ops-shell__notifications"
                role="dialog"
                aria-labelledby={notificationTitleId}
                tabIndex={-1}
                onKeyDown={(event) =>
                  closeOnEscape(event, () => closeNotifications())
                }
              >
                <header className="ops-shell__popover-header">
                  <div>
                    <p className="ops-shell__eyebrow">Operations center</p>
                    <h2 id={notificationTitleId}>Operations notifications</h2>
                  </div>
                  <button
                    className="ops-shell__popover-close"
                    type="button"
                    aria-label="Close notifications"
                    onClick={() => closeNotifications()}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </header>

                <ul className="ops-shell__notification-list">
                  {notifications.map((notification) => (
                    <li
                      key={notification.id}
                      className={
                        notification.read
                          ? 'ops-shell__notification ops-shell__notification--read'
                          : 'ops-shell__notification'
                      }
                    >
                      <span
                        className="ops-shell__notification-dot"
                        aria-hidden="true"
                      />
                      <div>
                        <strong>{notification.title}</strong>
                        <p>{notification.detail}</p>
                        <time>{notification.time}</time>
                      </div>
                      {notification.read ? (
                        <span className="ops-shell__read-status">
                          <Check size={14} aria-hidden="true" />
                          Read
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(notification.id)}
                          aria-label={`Mark ${notification.title} as read`}
                        >
                          Mark read
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <footer className="ops-shell__popover-footer">
                  {unreadCount > 0 ? (
                    <button type="button" onClick={markAllNotificationsRead}>
                      <CheckCheck size={16} aria-hidden="true" />
                      Mark all as read
                    </button>
                  ) : (
                    <span>You're all caught up.</span>
                  )}
                </footer>
              </div>
            ) : null}
          </div>

          <div className="ops-shell__account">
            <button
              ref={accountButtonRef}
              className="ops-shell__account-button"
              type="button"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              aria-controls={accountMenuId}
              onClick={toggleAccountMenu}
            >
              <span className="ops-shell__avatar" aria-hidden="true">AO</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>

            {isAccountMenuOpen ? (
              <div
                className="ops-shell__account-popover"
                onKeyDown={(event) => closeOnEscape(event, closeAccountMenu)}
              >
                <div
                  ref={accountMenuRef}
                  id={accountMenuId}
                  className="ops-shell__account-menu"
                  role="menu"
                  aria-label="Operator menu"
                  tabIndex={-1}
                >
                  <div className="ops-shell__operator" role="presentation">
                    <span className="ops-shell__avatar ops-shell__avatar--large" aria-hidden="true">
                      AO
                    </span>
                    <span>
                      <strong>Alex Okafor</strong>
                      <small>Operations Analyst</small>
                    </span>
                  </div>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={compactNavigation}
                    onClick={() => setCompactNavigation((isCompact) => !isCompact)}
                  >
                    <Settings size={17} aria-hidden="true" />
                    <span>
                      Preferences
                      <small>
                        Compact navigation {compactNavigation ? 'on' : 'off'}
                      </small>
                    </span>
                    <span
                      className={
                        compactNavigation
                          ? 'ops-shell__switch ops-shell__switch--on'
                          : 'ops-shell__switch'
                      }
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    aria-expanded={isHelpVisible}
                    onClick={() => setIsHelpVisible((isVisible) => !isVisible)}
                  >
                    <CircleHelp size={17} aria-hidden="true" />
                    <span>
                      Help &amp; support
                      <small>Show operator guidance</small>
                    </span>
                  </button>
                </div>

                {isHelpVisible ? (
                  <div className="ops-shell__help" role="status">
                    <strong>Operator help</strong>
                    <p>
                      Use the workspace links to switch tools. Press Escape to
                      close this menu or the notifications panel.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <aside className="ops-shell__nav">
        <nav id={navigationId} className="ops-shell__primary-nav" aria-label="Primary navigation">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = id === activeView

            return (
              <a
                key={id}
                href={`#${id}`}
                className={
                  isActive
                    ? 'ops-shell__nav-link ops-shell__nav-link--active'
                    : 'ops-shell__nav-link'
                }
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? label : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="ops-shell__nav-label">{label}</span>
              </a>
            )
          })}
        </nav>

        <button
          className="ops-shell__collapse"
          type="button"
          aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-controls={navigationId}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        >
          {isCollapsed ? (
            <PanelLeftOpen size={19} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={19} aria-hidden="true" />
          )}
          <span>Collapse</span>
        </button>
      </aside>

      <main className="workspace ops-shell__workspace">{children}</main>
    </div>
  )
}
