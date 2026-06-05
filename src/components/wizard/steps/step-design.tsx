'use client'
import { useState } from 'react'
import { Sparkles, Eye } from 'lucide-react'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { PhoneMockup } from '@/components/wizard/phone-mockup'
import { CoverPicker } from '@/components/wizard/cover-picker'
import { COVER_PRESETS } from '@/lib/cover-presets'

interface Props {
  eventName: string
  eventDate: string
  shotCap: number | null
  selectedCover: string | null
  onSelectPreset: (path: string) => void
  onSelectFile: (file: File, blobUrl: string) => void
  onNext: () => void
  onBack: () => void
  onExit: () => void
}

export function StepDesign({ eventName, eventDate, shotCap, selectedCover, onSelectPreset, onSelectFile, onNext, onBack, onExit }: Props) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <>
      <WizardShell
        currentStep={4} totalSteps={6}
        onBack={onBack}
        onExit={onExit}
        cta={
          <button
            onClick={onNext}
            disabled={!selectedCover}
            className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 transition-opacity flex items-center gap-2"
          >
            Continuar →
          </button>
        }
      >
        <div className="flex flex-col h-full pt-4 pb-2">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-white leading-tight">Design do seu evento.</h1>
            <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
              Essa capa é a primeira coisa que seus convidados vão ver.
            </p>
          </div>

          <div className="flex-1 flex items-center justify-center py-2">
            <PhoneMockup
              eventName={eventName}
              eventDate={eventDate}
              shotCap={shotCap}
              coverPreview={selectedCover}
            />
          </div>

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-full transition-colors"
            >
              <Sparkles size={14} />
              Editar Capa
            </button>
            <button
              type="button"
              disabled
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 text-zinc-500 text-sm font-medium rounded-full cursor-default"
            >
              <Eye size={14} />
              Preview
            </button>
          </div>
        </div>
      </WizardShell>

      {showPicker && (
        <CoverPicker
          mode="sheet"
          presetPaths={COVER_PRESETS}
          selected={selectedCover}
          onSelectPreset={onSelectPreset}
          onSelectFile={onSelectFile}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
