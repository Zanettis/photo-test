'use client'
import { useState, useRef } from 'react'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { SuggestionChips } from '@/components/wizard/suggestion-chips'

const NAME_SUGGESTIONS = ['Casamento', 'Aniversário', 'Formatura', 'Churrasco', 'Confraternização']

interface Props {
  name: string
  onChange: (val: string) => void
  onNext: () => void
  onExit: () => void
}

export function StepName({ name, onChange, onNext, onExit }: Props) {
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleNext() {
    if (!name.trim()) { setError('Dá um nome pra festa primeiro'); return }
    setError('')
    onNext()
  }

  return (
    <WizardShell
      currentStep={1} totalSteps={5}
      onExit={onExit}
      cta={
        <button
          onClick={handleNext}
          disabled={!name.trim()}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 transition-opacity flex items-center gap-2"
        >
          Continuar →
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">Como se chama a festa?</h1>
          <p className="text-zinc-500 mt-3 text-sm leading-relaxed">Esse nome aparece para os convidados ao entrar</p>
        </div>

        <div>
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={name}
            onChange={e => { onChange(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleNext()}
            maxLength={80}
            placeholder="Casamento Ana e Pedro"
            className="w-full px-4 py-4 bg-zinc-900 border border-zinc-700 rounded-2xl text-white text-lg placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
          />
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        <div>
          <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Sugestões</p>
          <SuggestionChips
            options={NAME_SUGGESTIONS}
            onSelect={val => { onChange(val); inputRef.current?.focus() }}
          />
        </div>
      </div>
    </WizardShell>
  )
}
