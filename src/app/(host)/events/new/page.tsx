'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { SuggestionChips } from '@/components/wizard/suggestion-chips'
import { useWizardState } from '@/hooks/use-wizard-state'
import { GUEST_TIERS, calcEventPrice, unlimitedPhotosAddon, formatPrice } from '@/lib/pricing'
import { cn } from '@/lib/utils'

const NAME_SUGGESTIONS = ['Casamento', 'Aniversário', 'Formatura', 'Churrasco', 'Confraternização']

function parseDateInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  const d = parseInt(day), m = parseInt(month), y = parseInt(year)
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2099) return null
  return `${year}-${month}-${day}`
}

function datePreview(isoDate: string): string {
  try {
    return new Date(isoDate + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
  } catch { return '' }
}

function getNextSaturday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 6 ? 7 : 6 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function toDateInput(iso: string): string {
  const [y, m, day] = iso.split('-')
  return `${day}/${m}/${y}`
}

function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export default function NewEventPage() {
  const router = useRouter()
  const { step, data, isSubmitting, error, updateField, nextStep, prevStep, submit } = useWizardState()

  // W1
  const [nameError, setNameError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // W2
  const [dateInput, setDateInput] = useState('')
  const [dateError, setDateError] = useState('')

  // W4
  const [revealMode, setRevealMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [revealDateInput, setRevealDateInput] = useState('')
  const [revealTimeInput, setRevealTimeInput] = useState('')

  function handleNameNext() {
    if (!data.name?.trim()) { setNameError('Dá um nome pra festa primeiro'); return }
    setNameError('')
    nextStep()
  }

  function handleDateNext() {
    const iso = parseDateInput(dateInput)
    if (!iso) { setDateError('Data inválida. Use DD/MM/AAAA'); return }
    setDateError('')
    updateField('event_date', iso)
    nextStep()
  }

  function setQuickDate(iso: string) {
    updateField('event_date', iso)
    setDateInput(toDateInput(iso))
    setDateError('')
  }

  function buildRevealAt(): string | null {
    if (revealMode === 'immediate') return null
    const iso = parseDateInput(revealDateInput)
    if (!iso) return null
    const time = revealTimeInput || '12:00'
    return new Date(`${iso}T${time}:00`).toISOString()
  }

  async function handleSubmit() {
    const revealAt = buildRevealAt()
    updateField('reveal_at', revealAt)
    const slug = await submit()
    if (slug) router.push(`/events/${slug}/share`)
  }

  // W1 — Nome
  if (step === 1) {
    return (
      <WizardShell
        currentStep={1} totalSteps={4}
        onExit={() => router.push('/dashboard')}
        cta={
          <button
            onClick={handleNameNext}
            disabled={!data.name?.trim()}
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
              ref={nameInputRef}
              type="text"
              autoFocus
              value={data.name ?? ''}
              onChange={e => { updateField('name', e.target.value); setNameError('') }}
              onKeyDown={e => e.key === 'Enter' && handleNameNext()}
              maxLength={80}
              placeholder="Casamento Ana e Pedro"
              className="w-full px-4 py-4 bg-zinc-900 border border-zinc-700 rounded-2xl text-white text-lg placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {nameError && <p className="text-red-400 text-sm mt-2">{nameError}</p>}
          </div>

          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Sugestões</p>
            <SuggestionChips
              options={NAME_SUGGESTIONS}
              onSelect={val => { updateField('name', val); nameInputRef.current?.focus() }}
            />
          </div>
        </div>
      </WizardShell>
    )
  }

  // W2 — Data
  if (step === 2) {
    const previewIso = parseDateInput(dateInput)
    return (
      <WizardShell
        currentStep={2} totalSteps={4}
        onBack={prevStep}
        onExit={() => router.push('/dashboard')}
        cta={
          <button
            onClick={handleDateNext}
            disabled={!dateInput}
            className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 transition-opacity flex items-center gap-2"
          >
            Continuar →
          </button>
        }
      >
        <div className="flex flex-col gap-6 pt-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">Quando é o evento?</h1>
            <p className="text-zinc-500 mt-3 text-sm">A data ajuda a organizar sua galeria</p>
          </div>

          <div>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={dateInput}
              onChange={e => {
                setDateInput(maskDate(e.target.value))
                setDateError('')
              }}
              onKeyDown={e => e.key === 'Enter' && handleDateNext()}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              className="w-full px-4 py-4 bg-zinc-900 border border-zinc-700 rounded-2xl text-white text-xl placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
            />
            {previewIso && !dateError && (
              <p className="text-zinc-400 text-sm mt-2 capitalize">{datePreview(previewIso)}</p>
            )}
            {dateError && <p className="text-red-400 text-sm mt-2">{dateError}</p>}
          </div>

          <div>
            <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Atalhos</p>
            <SuggestionChips
              options={['Hoje', 'Próximo sábado']}
              onSelect={label => {
                const iso = label === 'Hoje' ? new Date().toISOString().slice(0, 10) : getNextSaturday()
                setQuickDate(iso)
              }}
            />
          </div>
        </div>
      </WizardShell>
    )
  }

  // W3 — Convidados + Fotos
  if (step === 3) {
    const selectedTier = GUEST_TIERS.find(t => t.guest_cap === (data.guest_cap ?? 5)) ?? GUEST_TIERS[0]
    const isUnlimited = data.shot_cap === null
    const totalPrice = calcEventPrice(data.guest_cap ?? 5, data.shot_cap ?? 10)
    const addonPrice = unlimitedPhotosAddon(data.guest_cap ?? 5)

    return (
      <WizardShell
        currentStep={3} totalSteps={4}
        onBack={prevStep}
        onExit={() => router.push('/dashboard')}
        cta={
          <button
            onClick={nextStep}
            className="px-6 py-3 bg-white text-black font-semibold rounded-2xl flex items-center gap-2"
          >
            Continuar →
          </button>
        }
      >
        <div className="flex flex-col gap-5 pt-6 pb-4 overflow-y-auto">
          {/* Seção 1: Convidados */}
          <div>
            <h1 className="text-3xl font-bold text-white leading-tight">Quantos convidados?</h1>
            <p className="text-zinc-500 mt-2 text-sm">Número de pessoas que vão enviar fotos</p>
          </div>

          <div className="-mx-6 px-6 overflow-x-auto">
            <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
              {GUEST_TIERS.map(tier => (
                <button
                  key={String(tier.guest_cap)}
                  type="button"
                  onClick={() => updateField('guest_cap', tier.guest_cap)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm whitespace-nowrap transition-all',
                    (data.guest_cap ?? 5) === tier.guest_cap
                      ? 'bg-white text-black font-semibold'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  )}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {formatPrice(totalPrice)}
            </span>
            {totalPrice > 0 && <span className="text-zinc-500 text-sm">/evento</span>}
            {selectedTier.price === 0 && <span className="text-zinc-500 text-sm">para sempre</span>}
          </div>

          <div className="border-t border-zinc-800" />

          {/* Seção 2: Fotos */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-widest">Fotos ilimitadas</p>
                <p className="text-zinc-400 text-sm mt-0.5">
                  {isUnlimited
                    ? `+ ${formatPrice(addonPrice)} incluído`
                    : 'Adicionar por ' + formatPrice(addonPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateField('shot_cap', isUnlimited ? 10 : null)}
                aria-label="Fotos ilimitadas"
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors shrink-0',
                  isUnlimited ? 'bg-white' : 'bg-zinc-700'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full transition-transform',
                  isUnlimited ? 'translate-x-7 bg-black' : 'translate-x-1 bg-zinc-400'
                )} />
              </button>
            </div>

            {!isUnlimited && (
              <div>
                <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Fotos por pessoa</p>
                <div className="flex gap-2">
                  {[5, 10, 20].map(cap => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => updateField('shot_cap', cap)}
                      className={cn(
                        'rounded-full px-5 py-2 text-sm transition-all',
                        data.shot_cap === cap
                          ? 'bg-white text-black font-semibold'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      )}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </WizardShell>
    )
  }

  // W4 — Revelação
  return (
    <WizardShell
      currentStep={4} totalSteps={4}
      onBack={prevStep}
      onExit={() => router.push('/dashboard')}
      cta={
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-50 transition-opacity flex items-center gap-2"
        >
          {isSubmitting ? 'Criando...' : 'Criar evento'}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">Quando revelar as fotos?</h1>
          <p className="text-zinc-500 mt-3 text-sm">Crie expectativa revelando a galeria depois do evento</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setRevealMode('immediate')}
            className={`rounded-2xl border p-4 text-left transition-all ${revealMode === 'immediate' ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'}`}
          >
            <p className={`font-semibold ${revealMode === 'immediate' ? 'text-white' : 'text-zinc-300'}`}>Mostrar na hora</p>
            <p className="text-xs text-zinc-500 mt-1">Convidados veem as fotos assim que enviam</p>
          </button>

          <button
            type="button"
            onClick={() => setRevealMode('scheduled')}
            className={`rounded-2xl border p-4 text-left transition-all ${revealMode === 'scheduled' ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'}`}
          >
            <p className={`font-semibold ${revealMode === 'scheduled' ? 'text-white' : 'text-zinc-300'}`}>Agendar revelação</p>
            <p className="text-xs text-zinc-500 mt-1">Galeria fica oculta até a data escolhida</p>
          </button>
        </div>

        {revealMode === 'scheduled' && (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={revealDateInput}
              onChange={e => setRevealDateInput(maskDate(e.target.value))}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <input
              type="time"
              value={revealTimeInput}
              onChange={e => setRevealTimeInput(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl text-white focus:outline-none focus:border-zinc-500"
            />
            <div className="flex gap-2 flex-wrap">
              <SuggestionChips
                options={['No dia do evento', '48h após']}
                onSelect={label => {
                  if (label === 'No dia do evento' && data.event_date) {
                    setRevealDateInput(toDateInput(data.event_date))
                    setRevealTimeInput('12:00')
                  } else if (label === '48h após' && data.event_date) {
                    const d = new Date(data.event_date + 'T12:00:00')
                    d.setDate(d.getDate() + 2)
                    setRevealDateInput(toDateInput(d.toISOString().slice(0, 10)))
                    setRevealTimeInput('12:00')
                  }
                }}
              />
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="button"
          onClick={() => { updateField('reveal_at', null); setRevealMode('immediate'); handleSubmit() }}
          className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors"
        >
          Pular → revelar imediatamente
        </button>
      </div>
    </WizardShell>
  )
}
