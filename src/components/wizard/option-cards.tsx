import { cn } from '@/lib/utils'

interface Option<T> {
  value: T
  label: string
  sublabel?: string
}

interface Props<T> {
  options: Option<T>[]
  selected: T
  onSelect: (value: T) => void
}

export function OptionCards<T>({ options, selected, onSelect }: Props<T>) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt, i) => {
        const isSelected = opt.value === selected
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              isSelected
                ? 'border-white bg-zinc-800'
                : 'border-zinc-700 hover:border-zinc-500'
            )}
          >
            <div className={cn('text-2xl font-bold', isSelected ? 'text-white' : 'text-zinc-300')}>
              {opt.label}
            </div>
            {opt.sublabel && (
              <div className="text-xs text-zinc-500 mt-1">{opt.sublabel}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
