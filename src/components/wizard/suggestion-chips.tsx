import { cn } from '@/lib/utils'

interface Props {
  options: string[]
  onSelect: (value: string) => void
  selected?: string
}

export function SuggestionChips({ options, onSelect, selected }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onSelect(opt)}
          className={cn(
            'rounded-full border px-4 py-2 text-sm transition-colors',
            selected === opt
              ? 'border-white text-white bg-zinc-800'
              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
