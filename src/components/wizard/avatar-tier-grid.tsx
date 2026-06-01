'use client'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GuestTier } from '@/lib/pricing'

interface AvatarTierGridProps {
  tiers: GuestTier[]
  selectedCap: number | null
  onSelect: (cap: number | null) => void
}

export function AvatarTierGrid({ tiers, selectedCap, onSelect }: AvatarTierGridProps) {
  const selectedIndex = tiers.findIndex(t => t.guest_cap === selectedCap)

  return (
    <div className="flex justify-between w-full">
      {tiers.map((tier, i) => {
        const isLit = i <= selectedIndex
        return (
          <button
            key={String(tier.guest_cap)}
            type="button"
            onClick={() => onSelect(tier.guest_cap)}
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
              isLit ? 'bg-white' : 'bg-zinc-800'
            )}
          >
            <Users
              size={14}
              className={isLit ? 'text-black' : 'text-zinc-600'}
            />
          </button>
        )
      })}
    </div>
  )
}
