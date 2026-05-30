import { ArrowLeft, X } from 'lucide-react'
import { ProgressDots } from './progress-dots'

interface Props {
  currentStep: number
  totalSteps: number
  onBack?: () => void
  onExit: () => void
  cta: React.ReactNode
  children: React.ReactNode
}

export function WizardShell({ currentStep, totalSteps, onBack, onExit, cta, children }: Props) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* top nav */}
      <div className="flex items-center justify-between px-4 pt-safe pt-4 pb-3">
        {onBack ? (
          <button onClick={onBack} aria-label="Voltar" className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700 transition-colors">
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="w-10" />
        )}
        <button onClick={onExit} aria-label="Sair" className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* content */}
      <div className="flex-1 flex flex-col px-6 max-w-sm mx-auto w-full">
        {children}
      </div>

      {/* bottom bar */}
      <div className="flex items-center justify-between px-6 py-4 pb-safe max-w-sm mx-auto w-full">
        <ProgressDots current={currentStep} total={totalSteps} />
        {cta}
      </div>
    </div>
  )
}
