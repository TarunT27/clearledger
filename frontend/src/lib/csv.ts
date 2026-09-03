/**
 * CSV export.
 *
 * Exported cells carry counterparty names and payment descriptions, which are attacker
 * influenced. A spreadsheet treats a leading `=`, `+`, `-` or `@` as a formula, so those
 * values are prefixed with an apostrophe before quoting — otherwise opening an export
 * could execute something the ledger merely stored. Leading whitespace is skipped when
 * deciding, because spreadsheets ignore it too.
 */
const FORMULA_LEAD = /^[\s]*[=+\-@]/

export function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const neutralized = FORMULA_LEAD.test(raw) ? `'${raw}` : raw
  return /[",\n\r]/.test(neutralized)
    ? `"${neutralized.replace(/"/g, '""')}"`
    : neutralized
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\r\n')
}

/**
 * Offers a string to the browser as a file download.
 *
 * The object URL is revoked on the next tick rather than immediately: some browsers have
 * not finished reading the blob when the synchronous click returns.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
