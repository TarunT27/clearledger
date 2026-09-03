import { describe, expect, it, vi } from 'vitest'
import { downloadCsv, escapeCsvCell, toCsv } from './csv'

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

describe('CSV assembly and download', () => {
  it('joins rows with CRLF so spreadsheets read the file as one table', () => {
    const csv = toCsv(
      ['Reference', 'Recipient', 'Amount'],
      [
        ['PAY-0001', 'Northstar Supplies', '250.00'],
        ['PAY-0002', 'Cedar, Finch', '1200.00'],
      ],
    )

    expect(csv.split('\r\n')).toEqual([
      'Reference,Recipient,Amount',
      'PAY-0001,Northstar Supplies,250.00',
      'PAY-0002,"Cedar, Finch",1200.00',
    ])
  })

  it('hands the browser a blob and releases the object URL afterwards', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:clearledger/1')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    try {
      downloadCsv('payments.csv', 'a,b')

      expect(createObjectURL).toHaveBeenCalledOnce()
      expect(click).toHaveBeenCalledOnce()
      expect(document.querySelector('a')).toBeNull()
      expect(revokeObjectURL).not.toHaveBeenCalled()

      vi.runAllTimers()
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:clearledger/1')
    } finally {
      vi.useRealTimers()
    }
  })
})
