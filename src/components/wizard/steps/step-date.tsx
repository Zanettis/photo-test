'use client'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { MiniCalendar } from '@/components/wizard/mini-calendar'

interface Props {
  eventDate: string | null
  onChange: (iso: string) => void
  onNext: () => void
  onBack: () => void
  onExit: () => void
}

export function StepDate({ eventDate, onChange, onNext, onBack, onExit }: Props) {
  return (
    <WizardShell
      currentStep={2} totalSteps={5}
      onBack={onBack}
      onExit={onExit}
      cta={
        <button
          onClick={onNext}
          disabled={!eventDate}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 transition-opacity flex items-center gap-2"
        >
          Continuar →
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">Quando termina o evento?</h1>
          <p className="text-zinc-500 mt-3 text-sm">Os convidados podem enviar fotos até esse dia</p>
        </div>

        <MiniCalendar
          value={eventDate}
          onChange={onChange}
          minDate={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </WizardShell>
  )
}
