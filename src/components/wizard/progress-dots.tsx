import { cn } from '@/lib/utils'

interface Props {
  current: number  // 1-based
  total: number
}

export function ProgressDots({ current, total }: Props) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const pos = i + 1
        const isPast = pos < current
        const isCurrent = pos === current
        return (
          <div
            key={i}
            className={cn(
              'rounded-full transition-all duration-300',
              isCurrent ? 'w-6 h-2 bg-white' : isPast ? 'w-2 h-2 bg-zinc-400' : 'w-2 h-2 bg-zinc-700'
            )}
          />
        )
      })}
    </div>
  )
}
