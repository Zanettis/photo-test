'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { SuggestionChips } from '@/components/wizard/suggestion-chips'
import { MiniCalendar } from '@/components/wizard/mini-calendar'
import { PhoneMockup } from '@/components/wizard/phone-mockup'
import { CoverPicker } from '@/components/wizard/cover-picker'
import { AvatarTierGrid } from '@/components/wizard/avatar-tier-grid'
import { useWizardState } from '@/hooks/use-wizard-state'
import { GUEST_TIERS, calcEventPrice, unlimitedPhotosAddon, formatPrice } from '@/lib/pricing'
import { COVER_PRESETS } from '@/lib/cover-presets'
import { cn } from '@/lib/utils'
import { Sparkles, Eye, EyeOff } from 'lucide-react'

const NAME_SUGGESTIONS = ['Casamento', 'Aniversário', 'Formatura', 'Churrasco', 'Confraternização']


export default function NewEventPage() {
  const router = useRouter()
  const { step, data, isSubmitting, error, updateField, nextStep, prevStep, submit } = useWizardState()

  // W1
  const [nameError, setNameError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // W3 — Duração
  const [durationMode, setDurationMode] = useState<'horas' | 'dias'>('horas')
  const [durationValue, setDurationValue] = useState<number>(8)

  // W4
  const [revealMode, setRevealMode] = useState<'immediate' | 'scheduled'>('immediate')

  // W5
  const [selectedCover, setSelectedCover] = useState<string | null>(null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [step5Loading, setStep5Loading] = useState(false)
  const [step5Error, setStep5Error] = useState<string | null>(null)
  const [showCoverPicker, setShowCoverPicker] = useState(false)

  useEffect(() => {
    if (!selectedCover && COVER_PRESETS.length > 0) {
      setSelectedCover(COVER_PRESETS[0])
    }
  }, [])

  function inferDurationDefault(name: string): { mode: 'horas' | 'dias'; value: number } {
    const n = name.toLowerCase()
    if (/casamento|viagem/.test(n)) return { mode: 'dias', value: 1 }
    return { mode: 'horas', value: 8 }
  }

  function handleNameNext() {
    if (!data.name?.trim()) { setNameError('Dá um nome pra festa primeiro'); return }
    setNameError('')
    nextStep()
  }

  function handleDateNext() {
    if (!data.event_date) return
    const def = inferDurationDefault(data.name ?? '')
    setDurationMode(def.mode)
    setDurationValue(def.value)
    nextStep()
  }

  function handleDurationNext() {
    const ms = durationMode === 'horas'
      ? durationValue * 3600 * 1000
      : durationValue * 86400 * 1000
    const start = new Date((data.event_date ?? '') + 'T12:00:00')
    const closesAt = new Date(start.getTime() + ms).toISOString()
    updateField('closes_at', closesAt)
    nextStep()
  }

  function closesAtPreview(eventDate: string, mode: 'horas' | 'dias', value: number): string {
    try {
      const ms = mode === 'horas' ? value * 3600 * 1000 : value * 86400 * 1000
      const closes = new Date(new Date(eventDate + 'T12:00:00').getTime() + ms)
      return closes.toLocaleDateString('pt-BR', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return '' }
  }

  function handleRevealNext() {
    updateField('reveal_at', revealMode === 'scheduled' ? (data.closes_at ?? null) : null)
    nextStep()
  }

  async function handleDesignSubmit() {
    if (!selectedCover || step5Loading) return
    setStep5Loading(true)
    setStep5Error(null)

    const slug = await submit()
    if (!slug) { setStep5Loading(false); return }

    try {
      let coverPath = selectedCover

      if (coverImageFile) {
        const ext = coverImageFile.type === 'image/png' ? 'png' : 'jpg'
        const coverUrlRes = await fetch(`/api/events/${slug}/cover-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_ext: ext }),
        })
        if (!coverUrlRes.ok) throw new Error('cover_url_failed')
        const { upload_url, storage_path } = await coverUrlRes.json()

        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': coverImageFile.type },
          body: coverImageFile,
        })
        if (!uploadRes.ok) throw new Error('upload_failed')

        coverPath = storage_path
      }

      const patchRes = await fetch(`/api/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_path: coverPath }),
      })
      if (!patchRes.ok) throw new Error('cover_patch_failed')

      router.push(`/events/${slug}/share`)
    } catch {
      setStep5Error('Falha ao salvar a capa. Tente novamente.')
      setStep5Loading(false)
    }
  }

  // W1 — Nome
  if (step === 1) {
    return (
      <WizardShell
        currentStep={1} totalSteps={6}
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
  if (step === 2) return (
    <WizardShell
      currentStep={2} totalSteps={6}
      onBack={prevStep}
      onExit={() => router.push('/dashboard')}
      cta={
        <button
          onClick={handleDateNext}
          disabled={!data.event_date}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 transition-opacity flex items-center gap-2"
        >
          Continuar →
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">Quando é o evento?</h1>
          <p className="text-zinc-500 mt-3 text-sm">Toque no dia para selecionar a data</p>
        </div>

        <MiniCalendar
          value={data.event_date ?? null}
          onChange={iso => updateField('event_date', iso)}
          minDate={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </WizardShell>
  )

  // W3 — Duração
  if (step === 3) {
    const horasOpts = [2, 4, 6, 8, 12, 24]
    const diasOpts = [1, 2, 3, 5, 7, 14]
    const preview = data.event_date
      ? closesAtPreview(data.event_date, durationMode, durationValue)
      : ''

    return (
      <WizardShell
        currentStep={3} totalSteps={6}
        onBack={prevStep}
        onExit={() => router.push('/dashboard')}
        cta={
          <button
            onClick={handleDurationNext}
            className="px-6 py-3 bg-white text-black font-semibold rounded-2xl flex items-center gap-2"
          >
            Continuar →
          </button>
        }
      >
        <div className="flex flex-col gap-6 pt-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">Por quanto tempo?</h1>
            <p className="text-zinc-500 mt-3 text-sm">O evento fica aberto para envio de fotos</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['horas', 'dias'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setDurationMode(mode)
                  setDurationValue(mode === 'horas' ? 8 : 1)
                }}
                className={cn(
                  'rounded-full px-5 py-2 text-sm font-medium transition-all capitalize',
                  durationMode === mode
                    ? 'bg-white text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Value chips — grid 3×2 para caber sem scroll */}
          <div className="grid grid-cols-3 gap-2">
            {(durationMode === 'horas' ? horasOpts : diasOpts).map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setDurationValue(val)}
                className={cn(
                  'rounded-full py-2.5 text-sm font-medium transition-all',
                  durationValue === val
                    ? 'bg-white text-black font-semibold'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                )}
              >
                {durationMode === 'horas'
                  ? `${val}h`
                  : val === 1 ? '1 dia' : `${val} dias`}
              </button>
            ))}
          </div>

          {preview && (
            <p className="text-zinc-400 text-sm">
              Encerra em: <span className="text-zinc-200 capitalize">{preview}</span>
            </p>
          )}
        </div>
      </WizardShell>
    )
  }

  // W4 — Revelação
  if (step === 4) return (
    <WizardShell
      currentStep={4} totalSteps={6}
      onBack={prevStep}
      onExit={() => router.push('/dashboard')}
      cta={
        <button
          onClick={handleRevealNext}
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

        {/* Photo preview cards */}
        <div className="flex gap-3">
          {[
            { name: 'Ana.S', gradient: 'linear-gradient(160deg, #92400e, #1c1917)' },
            { name: 'Pedro.K', gradient: 'linear-gradient(160deg, #1e3a5f, #0f172a)' },
          ].map(card => (
            <div
              key={card.name}
              className="flex-1 rounded-2xl overflow-hidden relative"
              style={{ aspectRatio: '3/4' }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: card.gradient,
                  filter: revealMode === 'scheduled'
                    ? 'blur(10px) saturate(0.65)'
                    : 'blur(0px) saturate(1)',
                  transition: 'filter 450ms cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'scale(1.05)',
                }}
              />
              <span className="absolute top-3 left-3 text-white text-xs font-medium z-10 drop-shadow-sm">
                {card.name}
              </span>
              {revealMode === 'scheduled' && (
                <div className="absolute inset-x-0 bottom-3 mx-3 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 text-center z-10">
                  <p className="text-white text-xs">Revela após o evento</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Option buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setRevealMode('immediate')}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              revealMode === 'immediate' ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                key={revealMode === 'immediate' ? 'eye-on' : 'eye-off'}
                style={revealMode === 'immediate' ? { animation: 'option-pop 350ms ease-out' } : {}}
              >
                <Eye size={18} className={revealMode === 'immediate' ? 'text-white' : 'text-zinc-500'} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${revealMode === 'immediate' ? 'text-white' : 'text-zinc-300'}`}>
                  Durante o evento
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Convidados veem as fotos assim que enviam</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRevealMode('scheduled')}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all',
              revealMode === 'scheduled' ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                key={revealMode === 'scheduled' ? 'eye-hidden' : 'eye-visible'}
                style={revealMode === 'scheduled' ? { animation: 'option-shimmer 600ms ease-in-out' } : {}}
              >
                <EyeOff size={18} className={revealMode === 'scheduled' ? 'text-white' : 'text-zinc-500'} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${revealMode === 'scheduled' ? 'text-white' : 'text-zinc-300'}`}>
                  Depois do evento
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">Galeria fica oculta até o evento encerrar</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </WizardShell>
  )

  // W5 — Design da capa (agora antes do paywall)
  if (step === 5) {
    return (
      <>
        <WizardShell
          currentStep={5} totalSteps={6}
          onBack={prevStep}
          onExit={() => router.push('/dashboard')}
          cta={
            <button
              onClick={nextStep}
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
                eventName={data.name ?? ''}
                eventDate={data.event_date ?? ''}
                shotCap={data.shot_cap ?? null}
                coverPreview={selectedCover}
              />
            </div>

            <div className="flex gap-3 pb-2">
              <button
                type="button"
                onClick={() => setShowCoverPicker(true)}
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

        {showCoverPicker && (
          <CoverPicker
            mode="sheet"
            presetPaths={COVER_PRESETS}
            selected={selectedCover}
            onSelectPreset={path => {
              setSelectedCover(path)
              setCoverImageFile(null)
            }}
            onSelectFile={(file, blobUrl) => {
              setCoverImageFile(file)
              setSelectedCover(blobUrl)
            }}
            onClose={() => setShowCoverPicker(false)}
          />
        )}
      </>
    )
  }

  // W6 — Convidados + Fotos (paywall — último step, submit aqui)
  // Usar !== undefined (não ??) para preservar null = "sem limite"
  const guestCap = data.guest_cap !== undefined ? data.guest_cap : 5
  const selectedTier = GUEST_TIERS.find(t => t.guest_cap === guestCap) ?? GUEST_TIERS[0]
  const isUnlimited = data.shot_cap === null
  const totalPrice = calcEventPrice(guestCap, data.shot_cap ?? 10)
  const addonPrice = unlimitedPhotosAddon(guestCap)

  return (
    <WizardShell
      currentStep={6} totalSteps={6}
      onBack={prevStep}
      onExit={() => router.push('/dashboard')}
      cta={
        <button
          onClick={handleDesignSubmit}
          disabled={step5Loading}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
        >
          {step5Loading ? 'Criando...' : 'Criar evento →'}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="text-3xl font-bold text-white leading-tight">Quantos convidados?</h1>
          <p className="text-zinc-500 mt-2 text-sm">Toque para selecionar o número de participantes</p>
        </div>

        {/* Tier label + preço */}
        <div className="flex items-baseline justify-between">
          <span className="text-white text-base font-medium">
            {selectedTier.label} {selectedTier.sublabel}
          </span>
          <span className="text-zinc-400 text-sm">
            {totalPrice === 0 ? 'Grátis' : formatPrice(selectedTier.price)}
          </span>
        </div>

        {/* Avatar grid — tap para selecionar tier */}
        <AvatarTierGrid
          tiers={GUEST_TIERS}
          selectedCap={guestCap}
          onSelect={cap => updateField('guest_cap', cap)}
        />

        <div className="border-t border-zinc-800" />

        {/* Fotos */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600 uppercase tracking-widest">Fotos ilimitadas</p>
              <p className="text-zinc-500 text-sm mt-0.5">
                {isUnlimited
                  ? `+ ${formatPrice(addonPrice)} incluído`
                  : `Adicionar por ${formatPrice(addonPrice)}`}
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

        {(error || step5Error) && (
          <p className="text-red-400 text-sm">{step5Error ?? error}</p>
        )}
      </div>
    </WizardShell>
  )
}
