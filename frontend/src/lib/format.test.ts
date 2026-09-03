import { describe, expect, it } from 'vitest'
import {
  formatCount,
  formatDuration,
  formatMetric,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatRelative,
  initialsOf,
  titleCase,
} from './format'

describe('money formatting', () => {
  it('renders integer minor units without floating-point drift', () => {
    expect(formatMoney(25_000, 'USD')).toBe('$250.00')
    expect(formatMoney(1, 'USD')).toBe('$0.01')
    expect(formatMoney(70_070, 'USD')).toBe('$700.70')
  })

  it('honours the currency it is given rather than assuming dollars', () => {
    expect(formatMoney(120_000, 'EUR')).toBe('€1,200.00')
    expect(formatMoney(120_000, 'GBP')).toBe('£1,200.00')
  })

  it('compacts large values for headline metrics', () => {
    expect(formatMoneyCompact(22_230_000, 'USD')).toBe('$222.3K')
  })
})

describe('metric formatting', () => {
  it('picks a representation from the unit the server declared', () => {
    expect(formatMetric(22_230_000, 'currency', 'USD')).toBe('$222.3K')
    expect(formatMetric(73.61, 'percent')).toBe('73.6%')
    expect(formatMetric(1_204, 'count')).toBe('1,204')
  })
})

describe('duration and relative time', () => {
  it('scales the unit to the magnitude', () => {
    expect(formatDuration(12)).toBe('12 sec')
    expect(formatDuration(420)).toBe('7 min')
    expect(formatDuration(7_200)).toBe('2 hr')
    expect(formatDuration(86_400)).toBe('1 day')
    expect(formatDuration(172_800)).toBe('2 days')
  })

  it('never reports a negative age for a clock skewed into the future', () => {
    const now = Date.parse('2026-09-03T12:00:00Z')
    expect(formatRelative('2026-09-03T12:05:00Z', now)).toBe('0 sec ago')
    expect(formatRelative('2026-09-03T11:53:00Z', now)).toBe('7 min ago')
  })

  it('renders a missing timestamp as an em dash rather than "Invalid Date"', () => {
    expect(formatRelative(null)).toBe('—')
  })
})

describe('text helpers', () => {
  it('formats counts, percentages, and enum labels', () => {
    expect(formatCount(1_204)).toBe('1,204')
    expect(formatPercent(73.61)).toBe('73.6%')
    expect(titleCase('APPROVED')).toBe('Approved')
    expect(titleCase('')).toBe('')
  })

  it('builds at most two initials and tolerates odd spacing', () => {
    expect(initialsOf('Northstar Supplies')).toBe('NS')
    expect(initialsOf('  Maple  Rock  Construction ')).toBe('MR')
    expect(initialsOf('Cobalt')).toBe('C')
  })
})
