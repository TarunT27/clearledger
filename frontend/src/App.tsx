import { useCallback, useEffect, useRef, useState } from 'react'
import { AppShell, type ViewId } from './components/AppShell'
import { PaymentComposer } from './components/PaymentComposer'
import { PaymentDetailSheet } from './components/PaymentDetailSheet'
import { ToastStack, type ToastMessage } from './components/primitives'
import { useResource } from './hooks/useResource'
import { consoleApi } from './lib/consoleApi'
import type { RangeId } from './lib/consoleTypes'
import { AuditPage } from './pages/AuditPage'
import { LedgerPage } from './pages/LedgerPage'
import { OverviewPage } from './pages/OverviewPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { ReconciliationPage } from './pages/ReconciliationPage'
import { RiskPage } from './pages/RiskPage'
import { ScenarioLabPage } from './pages/ScenarioLabPage'

const VIEWS: readonly ViewId[] = [
  'overview',
  'payments',
  'ledger',
  'risk',
  'reconciliation',
  'audit-log',
  'scenario-lab',
]

function viewFromHash(): ViewId {
  const candidate = window.location.hash.slice(1)
  return VIEWS.includes(candidate as ViewId) ? (candidate as ViewId) : 'overview'
}

export function App() {
  const [view, setView] = useState<ViewId>(viewFromHash)
  const [range, setRange] = useState<RangeId>('7d')
  const [globalQuery, setGlobalQuery] = useState('')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([])
  const [reloadToken, setReloadToken] = useState(0)
  const nextToastId = useRef(1)

  useEffect(() => {
    function onHashChange() {
      setView(viewFromHash())
    }
    if (!window.location.hash) window.history.replaceState(null, '', '#overview')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: ViewId) => {
    window.location.hash = next
    setView(next)
  }, [])

  // Changing view closes whatever was open over it and returns to the top of the page —
  // a hash router does neither on its own.
  useEffect(() => {
    setSelectedPaymentId(null)
    setComposing(false)
    window.scrollTo({ top: 0 })
  }, [view])

  const toast = useCallback((text: string, tone: 'success' | 'error') => {
    const id = nextToastId.current++
    setToasts((current) => [...current, { id, text, tone }])
    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      tone === 'error' ? 9000 : 6000,
    )
  }, [])

  const invalidate = useCallback(() => setReloadToken((value) => value + 1), [])

  /**
   * A cheap poll that drives the sidebar's connection dot and exception badge. It is the
   * only global request; every page owns its own data so a slow page cannot stall the rest
   * of the shell.
   */
  const loadStatus = useCallback(
    (signal: AbortSignal) => consoleApi.reconciliation(signal),
    [],
  )
  const status = useResource(loadStatus, [reloadToken], { pollMs: 30_000 })
  const connection = status.error ? 'offline' : status.data ? 'online' : 'pending'

  const search = useCallback(
    (query: string) => {
      setGlobalQuery(query)
      setSelectedPaymentId(null)
      navigate('payments')
    },
    [navigate],
  )

  const openPayment = useCallback((paymentId: string) => setSelectedPaymentId(paymentId), [])

  let page
  switch (view) {
    case 'payments':
      page = (
        <PaymentsPage
          initialQuery={globalQuery}
          onSelectPayment={openPayment}
          onCompose={() => setComposing(true)}
          reloadToken={reloadToken}
        />
      )
      break
    case 'ledger':
      page = <LedgerPage onSelectPayment={openPayment} reloadToken={reloadToken} />
      break
    case 'risk':
      page = (
        <RiskPage
          range={range}
          onRangeChange={setRange}
          onSelectPayment={openPayment}
          reloadToken={reloadToken}
        />
      )
      break
    case 'reconciliation':
      page = (
        <ReconciliationPage
          onSelectPayment={openPayment}
          onNavigate={navigate}
          onToast={toast}
          onChanged={invalidate}
          reloadToken={reloadToken}
        />
      )
      break
    case 'audit-log':
      page = <AuditPage onSelectPayment={openPayment} reloadToken={reloadToken} />
      break
    case 'scenario-lab':
      page = <ScenarioLabPage onNavigate={navigate} onToast={toast} onChanged={invalidate} />
      break
    default:
      page = (
        <OverviewPage
          range={range}
          onRangeChange={setRange}
          onNavigate={navigate}
          onSelectPayment={openPayment}
        />
      )
  }

  return (
    <AppShell
      activeView={view}
      onNavigate={navigate}
      onGlobalSearch={search}
      environmentLabel={
        import.meta.env.VITE_ENVIRONMENT_LABEL ?? 'Demo environment'
      }
      connection={connection}
      openExceptions={status.data?.stats.openCases ?? 0}
    >
      {page}

      {selectedPaymentId ? (
        <PaymentDetailSheet
          paymentId={selectedPaymentId}
          onClose={() => setSelectedPaymentId(null)}
        />
      ) : null}

      {composing ? (
        <PaymentComposer
          onClose={() => setComposing(false)}
          onCreated={(reference) => {
            toast(`${reference} created, risk assessed, and journaled.`, 'success')
            invalidate()
          }}
          onError={(message) => toast(message, 'error')}
        />
      ) : null}

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))}
      />
    </AppShell>
  )
}
