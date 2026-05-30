'use client'
import { useState } from 'react'

interface Props {
  eventName: string
  slug: string
  revealAt: string | null
  onComplete: () => void
}

export function GuestOnboarding({ eventName, slug, revealAt, onComplete }: Props) {
  const hasReveal = revealAt && new Date(revealAt) > new Date()
  const totalSlides = hasReveal ? 2 : 1
  const [slide, setSlide] = useState(0)

  function advance() {
    if (slide < totalSlides - 1) {
      setSlide(s => s + 1)
    } else {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarded_${slug}`, '1')
      }
      onComplete()
    }
  }

  const revealDateStr = hasReveal
    ? new Date(revealAt!).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-end px-6 pb-12">
      <div className="w-full max-w-sm flex flex-col gap-6 text-center">
        {slide === 0 && (
          <>
            <div className="text-5xl">📷</div>
            <div>
              <h2 className="text-white text-2xl font-bold">Você foi convidado para</h2>
              <h2 className="text-white text-2xl font-bold mt-1">{eventName}</h2>
              <p className="text-zinc-400 text-sm mt-3">Tire fotos e elas entram direto na galeria do evento</p>
            </div>
          </>
        )}
        {slide === 1 && hasReveal && (
          <>
            <div className="text-5xl">⏳</div>
            <div>
              <h2 className="text-white text-2xl font-bold">Fotos reveladas em</h2>
              <h2 className="text-white text-xl font-bold mt-1">{revealDateStr}</h2>
              <p className="text-zinc-400 text-sm mt-3">Por enquanto só o anfitrião vê. Deixe seu e-mail para ser avisado quando abrir.</p>
            </div>
          </>
        )}

        <button
          onClick={advance}
          className="w-full py-4 bg-white text-black font-semibold rounded-2xl text-base"
        >
          {slide < totalSlides - 1 ? 'Próximo →' : 'Começar a fotografar'}
        </button>
      </div>
    </div>
  )
}
