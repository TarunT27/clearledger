import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetDemoState } from '../lib/demoApi'

afterEach(() => {
  cleanup()
  resetDemoState()
})
