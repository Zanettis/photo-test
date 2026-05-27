export type { Database } from './database'

export interface EventState {
  isOpen: boolean
  isRevealed: boolean
  shotsUsed: number
  shotCap: number | null
  revealAt: string | null
}

export type TaggingStatus = 'pending' | 'processing' | 'done' | 'failed'
