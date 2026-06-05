'use client'
import { cn } from '@/lib/utils'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { PHOTO_FILTERS, getFilterCss } from '@/lib/photo-filters'

interface Props {
  selectedFilter: string
  previewImage: string | null
  onSelect: (id: string) => void
  onNext: () => void
  onBack: () => void
  onExit: () => void
}

export function StepFilter({ selectedFilter, previewImage, onSelect, onNext, onBack, onExit }: Props) {
  const filterCss = getFilterCss(selectedFilter)

  return (
    <WizardShell
      currentStep={5} totalSteps={6}
      onBack={onBack}
      onExit={onExit}
      cta={
        <button
          onClick={onNext}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl transition-opacity flex items-center gap-2"
        >
          Continuar →
        </button>
      }
    >
      <div className="flex flex-col h-full pt-4 pb-2">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-white leading-tight">Estilo das fotos.</h1>
          <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
            Aplicado em tempo real na câmera dos convidados.
          </p>
        </div>

        {/* Preview */}
        <div className="flex-1 relative rounded-[28px] overflow-hidden mb-5 min-h-0">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Preview do filtro"
              className="absolute inset-0 w-full h-full object-cover"
              style={filterCss !== 'none' ? { filter: filterCss } : undefined}
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-b from-amber-800 via-orange-500 to-yellow-400"
              style={filterCss !== 'none' ? { filter: filterCss } : undefined}
            />
          )}
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-xs font-medium">
              {PHOTO_FILTERS.find(f => f.id === selectedFilter)?.label ?? 'Original'}
            </span>
          </div>
        </div>

        {/* Filter swatches */}
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {PHOTO_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f.id)}
              className="flex flex-col items-center gap-1.5 shrink-0 transition-opacity"
              style={{ opacity: selectedFilter === f.id ? 1 : 0.45 }}
            >
              <div
                className={cn(
                  'w-16 h-16 rounded-xl overflow-hidden relative',
                  selectedFilter === f.id && 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0a0a]'
                )}
              >
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={f.label}
                    className="w-full h-full object-cover"
                    style={f.css !== 'none' ? { filter: f.css } : undefined}
                  />
                ) : (
                  <div
                    className="w-full h-full bg-gradient-to-b from-amber-800 via-orange-500 to-yellow-400"
                    style={f.css !== 'none' ? { filter: f.css } : undefined}
                  />
                )}
              </div>
              <span className={cn(
                'text-xs',
                selectedFilter === f.id ? 'text-white font-medium' : 'text-zinc-500'
              )}>
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </WizardShell>
  )
}
