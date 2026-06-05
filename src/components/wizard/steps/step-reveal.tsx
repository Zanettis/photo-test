'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { cn } from '@/lib/utils'

interface Props {
  closesAt: string | null
  onNext: (revealAt: string | null) => void
  onBack: () => void
  onExit: () => void
}

export function StepReveal({ closesAt, onNext, onBack, onExit }: Props) {
  const [mode, setMode] = useState<'immediate' | 'scheduled'>('immediate')

  function handleNext() {
    onNext(mode === 'scheduled' ? closesAt : null)
  }

  return (
    <WizardShell
      currentStep={3} totalSteps={6}
      onBack={onBack}
      onExit={onExit}
      cta={
        <button
          onClick={handleNext}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl flex items-center gap-2"
        >
          Continuar →
        </button>
      }
    >
      <div className="flex flex-col gap-5 pt-6">
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">Quando revelar as fotos?</h1>
          <p className="text-zinc-500 mt-3 text-sm">Crie expectativa revelando a galeria depois do evento</p>
        </div>

        <div className="flex gap-3">
          {[
            { name: 'Ana.S', gradient: 'linear-gradient(160deg, #92400e, #1c1917)' },
            { name: 'Pedro.K', gradient: 'linear-gradient(160deg, #1e3a5f, #0f172a)' },
          ].map(card => (
            <div key={card.name} className="flex-1 rounded-2xl overflow-hidden relative" style={{ aspectRatio: '3/4' }}>
              <div
                className="absolute inset-0"
                style={{
                  background: card.gradient,
                  filter: mode === 'scheduled' ? 'blur(10px) saturate(0.65)' : 'blur(0px) saturate(1)',
                  transition: 'filter 450ms cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'scale(1.05)',
                }}
              />
              <span className="absolute top-3 left-3 text-white text-xs font-medium z-10 drop-shadow-sm">{card.name}</span>
              {mode === 'scheduled' && (
                <div className="absolute inset-x-0 bottom-3 mx-3 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 text-center z-10">
                  <p className="text-white text-xs">Revela após o evento</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {([
            { value: 'immediate', icon: Eye, label: 'Durante o evento', sub: 'Convidados veem as fotos assim que enviam' },
            { value: 'scheduled', icon: EyeOff, label: 'Depois do evento', sub: 'Galeria fica oculta até o evento encerrar' },
          ] as const).map(({ value, icon: Icon, label, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'rounded-2xl border p-4 text-left transition-all',
                mode === value ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={mode === value ? 'text-white' : 'text-zinc-500'} />
                <div>
                  <p className={`font-semibold text-sm ${mode === value ? 'text-white' : 'text-zinc-300'}`}>{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </WizardShell>
  )
}
