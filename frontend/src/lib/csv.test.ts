import { describe, expect, it } from 'vitest'
import { escapeCsvCell } from './csv'

describe('CSV cell escaping', () => {
  it('neutralizes spreadsheet formulas in user-controlled values', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1")
    expect(escapeCsvCell('+cmd')).toBe("'+cmd")
    expect(escapeCsvCell('-2+3')).toBe("'-2+3")
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(escapeCsvCell('  =HYPERLINK("https://example.test")'))
      .toBe(`"'  =HYPERLINK(""https://example.test"")"`)
    expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1")
    expect(escapeCsvCell(' \t@SUM(A1)')).toBe("' \t@SUM(A1)")
    expect(escapeCsvCell('\n=1+1')).toBe(`"'
=1+1"`)
  })

  it('quotes CSV control characters without changing ordinary values', () => {
    expect(escapeCsvCell('Northstar Supplies')).toBe('Northstar Supplies')
    expect(escapeCsvCell('Cedar, Finch')).toBe('"Cedar, Finch"')
    expect(escapeCsvCell('A "quoted" recipient')).toBe('"A ""quoted"" recipient"')
    expect(escapeCsvCell(12_480)).toBe('12480')
  })
})
