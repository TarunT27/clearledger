import { describe, expect, it } from 'vitest'
import { recipientIdFor } from './api'

describe('production API contract', () => {
  it('maps a recipient label to a stable backend UUID', () => {
    const first = recipientIdFor('Northstar Supplies')
    const replay = recipientIdFor('Northstar Supplies')

    expect(first).toBe(replay)
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(recipientIdFor('Summit Office LLC')).not.toBe(first)
  })
})
