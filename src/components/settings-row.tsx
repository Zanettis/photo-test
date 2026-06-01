'use client'

import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SettingsRowProps {
  icon: LucideIcon
  label: string
  value?: string
  badge?: string
  onClick?: () => void
  disabled?: boolean
}

interface SettingsToggleRowProps {
  icon: LucideIcon
  label: string
  checked: boolean
  onToggle: (v: boolean) => void
  disabled?: boolean
}

export function SettingsRow({ icon: Icon, label, value, badge, onClick, disabled }: SettingsRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 w-full px-4 py-4 text-left transition-colors hover:bg-zinc-800/50 active:bg-zinc-800 disabled:opacity-50"
    >
      <Icon size={20} className="text-zinc-400 shrink-0" />
      <span className="text-white text-sm flex-1">{label}</span>
      {badge && (
        <span className="text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {value && <span className="text-zinc-400 text-sm">{value}</span>}
      <ChevronRight size={16} className="text-zinc-600 shrink-0" />
    </button>
  )
}

export function SettingsToggleRow({ icon: Icon, label, checked, onToggle, disabled }: SettingsToggleRowProps) {
  return (
    <div className="flex items-center gap-3 w-full px-4 py-4">
      <Icon size={20} className="text-zinc-400 shrink-0" />
      <span className="text-white text-sm flex-1">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-green-500' : 'bg-zinc-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
