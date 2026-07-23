import type { ReactNode } from 'react'
import type { Tone } from '../types'

export function StatusPill({
  tone,
  children,
}: {
  readonly tone: Tone
  readonly children: ReactNode
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>
}
