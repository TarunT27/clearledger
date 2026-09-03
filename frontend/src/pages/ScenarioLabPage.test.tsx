import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScenarioLabPage } from './ScenarioLabPage'
import { mockFetch } from '../test/fixtures'

const timeoutResult = {
  scenario: 'timeout',
  narrative:
    'A timeout left status pending after ledger commit; reconciliation is now required.',
  before: null,
  after: null,
  duplicateDetected: false,
  timeline: ['journal committed', 'timeout injected', 'reconciliation required'],
}

describe('scenario lab', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch({ '/demo/scenarios/': timeoutResult }))
  })

  it('describes each safety property before anything is run', () => {
    render(<ScenarioLabPage onNavigate={vi.fn()} onToast={vi.fn()} onChanged={vi.fn()} />)

    expect(screen.getByText('Normal payment')).toBeInTheDocument()
    expect(screen.getByText('Duplicate request')).toBeInTheDocument()
    expect(screen.getByText('Timeout after commit')).toBeInTheDocument()
    expect(screen.getByText('Verify, never retry')).toBeInTheDocument()
  })

  it('runs a scenario against the live API and reports its timeline', async () => {
    const onToast = vi.fn()
    const onChanged = vi.fn()
    const fetchMock = mockFetch({ '/demo/scenarios/': timeoutResult })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<ScenarioLabPage onNavigate={vi.fn()} onToast={onToast} onChanged={onChanged} />)
    await user.click(screen.getAllByRole('button', { name: 'Run' })[2])

    await waitFor(() => expect(onToast).toHaveBeenCalledWith(timeoutResult.narrative, 'success'))
    expect(onChanged).toHaveBeenCalled()
    expect(String(fetchMock.mock.calls[0][0])).toContain('/demo/scenarios/timeout')
    expect(await screen.findByText('journal committed')).toBeInTheDocument()
  })

  it('offers a route to the repair once a timeout has been created', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<ScenarioLabPage onNavigate={onNavigate} onToast={vi.fn()} onChanged={vi.fn()} />)

    await user.click(screen.getAllByRole('button', { name: 'Run' })[2])
    await user.click(await screen.findByRole('button', { name: 'Go repair it' }))

    expect(onNavigate).toHaveBeenCalledWith('reconciliation')
  })

  it('reports a failed scenario rather than pretending it ran', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const onToast = vi.fn()
    const user = userEvent.setup()
    render(<ScenarioLabPage onNavigate={vi.fn()} onToast={onToast} onChanged={vi.fn()} />)

    await user.click(screen.getAllByRole('button', { name: 'Run' })[0])

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        'Cannot reach the ClearLedger API. Is the service running?',
        'error',
      ),
    )
  })
})
