'use client'
import { WizardShell } from '@/components/wizard/wizard-shell'
import { AvatarTierGrid } from '@/components/wizard/avatar-tier-grid'
import { GUEST_TIERS, calcEventPrice, unlimitedPhotosAddon, formatPrice } from '@/lib/pricing'
import { cn } from '@/lib/utils'

interface Props {
  guestCap: number | null
  shotCap: number | null
  onChangeGuestCap: (cap: number | null) => void
  onChangeShotCap: (cap: number | null) => void
  onSubmit: () => void
  onBack: () => void
  onExit: () => void
  loading: boolean
  error: string | null
}

export function StepPlan({ guestCap, shotCap, onChangeGuestCap, onChangeShotCap, onSubmit, onBack, onExit, loading, error }: Props) {
  const selectedTier = GUEST_TIERS.find(t => t.guest_cap === guestCap) ?? GUEST_TIERS[0]
  const isUnlimited = shotCap === null
  const totalPrice = calcEventPrice(guestCap, shotCap ?? 10)
  const addonPrice = unlimitedPhotosAddon(guestCap)

  return (
    <WizardShell
      currentStep={5} totalSteps={5}
      onBack={onBack}
      onExit={onExit}
      cta={
        <button
          onClick={onSubmit}
          disabled={loading}
          className="px-6 py-3 bg-white text-black font-semibold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
        >
          {loading ? 'Criando...' : 'Criar evento →'}
        </button>
      }
    >
      <div className="flex flex-col gap-6 pt-6">
        <div>
          <h1 className="text-3xl font-bold text-white leading-tight">Quantos convidados?</h1>
          <p className="text-zinc-500 mt-2 text-sm">Toque para selecionar o número de participantes</p>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-white text-base font-medium">
            {selectedTier.label} {selectedTier.sublabel}
          </span>
          <span className="text-zinc-400 text-sm">
            {totalPrice === 0 ? 'Grátis' : formatPrice(selectedTier.price)}
          </span>
        </div>

        <AvatarTierGrid
          tiers={GUEST_TIERS}
          selectedCap={guestCap}
          onSelect={onChangeGuestCap}
        />

        <div className="border-t border-zinc-800" />

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
              onClick={() => onChangeShotCap(isUnlimited ? 10 : null)}
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
                    onClick={() => onChangeShotCap(cap)}
                    className={cn(
                      'rounded-full px-5 py-2 text-sm transition-all',
                      shotCap === cap
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

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </WizardShell>
  )
}
