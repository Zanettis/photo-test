'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MiniCalendarProps {
  value: string | null
  onChange: (iso: string) => void
  minDate?: string
}

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const parts = iso.split('-')
  if (parts.length !== 3) return null
  return { y: parseInt(parts[0]), m: parseInt(parts[1]) - 1, d: parseInt(parts[2]) }
}

export function MiniCalendar({ value, onChange, minDate }: MiniCalendarProps) {
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const min = minDate ?? todayISO

  const initial = value ? parseISO(value) : null
  const [viewYear, setViewYear] = useState(initial?.y ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial?.m ?? today.getMonth())

  const minParsed = parseISO(min)

  function isBeforeMin(iso: string): boolean {
    return iso < min
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const canGoPrev = minParsed
    ? viewYear > minParsed.y || (viewYear === minParsed.y && viewMonth > minParsed.m)
    : true

  // Build grid: 6 rows × 7 cols, starting Sunday
  const firstDow = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()

  const cells: Array<{ iso: string; day: number; isCurrentMonth: boolean }> = []

  // Overflow from previous month
  for (let i = firstDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = viewMonth === 0 ? 11 : viewMonth - 1
    const y = viewMonth === 0 ? viewYear - 1 : viewYear
    cells.push({ iso: toISO(y, m, d), day: d, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: toISO(viewYear, viewMonth, d), day: d, isCurrentMonth: true })
  }

  // Overflow to next month — fill to 42 cells (6 rows)
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1
    const y = viewMonth === 11 ? viewYear + 1 : viewYear
    cells.push({ iso: toISO(y, m, d), day: d, isCurrentMonth: false })
  }

  return (
    <div className="w-full select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={prevMonth}
          disabled={!canGoPrev}
          aria-label="Mês anterior"
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-20 hover:bg-zinc-800 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={18} className="text-zinc-300" />
        </button>

        <span className="text-white font-semibold text-base">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <button
          type="button"
          onClick={nextMonth}
          aria-label="Próximo mês"
          className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-zinc-800"
        >
          <ChevronRight size={18} className="text-zinc-300" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-xs text-zinc-500 font-medium py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((cell) => {
          const isPast = isBeforeMin(cell.iso)
          const isSelected = value === cell.iso
          const isToday = cell.iso === todayISO

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={isPast || !cell.isCurrentMonth}
              onClick={() => onChange(cell.iso)}
              className={cn(
                'aspect-square w-full flex items-center justify-center rounded-xl text-sm transition-all',
                !cell.isCurrentMonth && 'text-zinc-700 cursor-default',
                cell.isCurrentMonth && isPast && 'text-zinc-600 cursor-default',
                cell.isCurrentMonth && !isPast && !isSelected && 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
                isToday && !isSelected && 'text-white',
                isSelected && 'bg-zinc-700 text-white font-semibold',
              )}
            >
              {cell.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
