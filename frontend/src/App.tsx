import { CheckCircle2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppShell, type ViewId } from './components/AppShell'
import {
  addOperationsPayment,
  createOperationsFixture,
  repairReconciliationCase,
  type AddOperationsPaymentInput,
  type OperationsFixture,
} from './lib/operationsData'
import { AuditPage } from './pages/AuditPage'
import { LedgerPage } from './pages/LedgerPage'
import { OverviewPage } from './pages/OverviewPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { ReconciliationPage } from './pages/ReconciliationPage'
import { RiskPage } from './pages/RiskPage'
import { ScenarioLabPage } from './pages/ScenarioLabPage'

const VALID_VIEWS: readonly ViewId[] = [
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
  return VALID_VIEWS.includes(candidate as ViewId) ? candidate as ViewId : 'overview'
}

function navigate(view: ViewId) {
  if (window.location.hash === `#${view}`) {
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    return
  }
  window.location.hash = view
}

export function App() {
  const [activeView, setActiveView] = useState<ViewId>(viewFromHash)
  const [fixture, setFixture] = useState<OperationsFixture>(createOperationsFixture)
  const [globalQuery, setGlobalQuery] = useState('')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    function handleHashChange() {
      const nextView = viewFromHash()
      setActiveView(nextView)
      if (!window.location.hash || window.location.hash === '#') {
        window.history.replaceState(null, '', '#overview')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function searchPayments(query: string) {
    setGlobalQuery(query)
    setSelectedPaymentId(null)
    navigate('payments')
  }

  function openPayment(paymentId: string) {
    setSelectedPaymentId(paymentId)
    setGlobalQuery('')
    navigate('payments')
  }

  function createPayment(input: AddOperationsPaymentInput) {
    const nextFixture = addOperationsPayment(fixture, input)
    const newPayment = nextFixture.payments[0]
    setFixture(nextFixture)
    setSelectedPaymentId(newPayment?.id ?? null)
    setNotice(newPayment
      ? `${newPayment.id} approved and posted to a balanced journal.`
      : 'Payment created.')
  }

  function repairCase(caseId: string) {
    const target = fixture.reconciliationCases.find((item) => item.id === caseId)
    const nextFixture = repairReconciliationCase(fixture, caseId)
    setFixture(nextFixture)
    setNotice(target
      ? `${target.paymentId} safely repaired using its existing journal.`
      : 'Reconciliation repair completed.')
  }

  let page
  switch (activeView) {
    case 'payments':
      page = (
        <PaymentsPage
          data={fixture}
          initialQuery={globalQuery}
          selectedPaymentId={selectedPaymentId}
          onSelectPayment={setSelectedPaymentId}
          onCreatePayment={createPayment}
          onClearGlobalQuery={() => setGlobalQuery('')}
        />
      )
      break
    case 'ledger':
      page = <LedgerPage fixture={fixture} onSelectPayment={openPayment} />
      break
    case 'risk':
      page = <RiskPage fixture={fixture} onSelectPayment={openPayment} />
      break
    case 'reconciliation':
      page = (
        <ReconciliationPage
          fixture={fixture}
          onRepair={repairCase}
          onSelectPayment={openPayment}
        />
      )
      break
    case 'audit-log':
      page = <AuditPage fixture={fixture} onSelectPayment={openPayment} />
      break
    case 'scenario-lab':
      page = <ScenarioLabPage />
      break
    case 'overview':
    default:
      page = (
        <OverviewPage
          data={fixture}
          onNavigate={navigate}
          onSelectPayment={openPayment}
        />
      )
      break
  }

  return (
    <AppShell
      activeView={activeView}
      environmentLabel={import.meta.env.VITE_DEMO_MODE === 'true' ? 'Demo environment' : 'Local environment'}
      onGlobalSearch={searchPayments}
    >
      {page}
      {notice ? (
        <div className="toast toast--success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </AppShell>
  )
}
