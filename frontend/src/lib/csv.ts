const SPREADSHEET_FORMULA_PREFIX = /^\s*[=+\-@]/

export function escapeCsvCell(value: string | number): string {
  const source = String(value)
  const safeValue = SPREADSHEET_FORMULA_PREFIX.test(source) ? `'${source}` : source
  return /[",\n\r]/.test(safeValue)
    ? `"${safeValue.replaceAll('"', '""')}"`
    : safeValue
}
