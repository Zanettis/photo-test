'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface WizardData {
  name: string
  event_date: string     // YYYY-MM-DD
  shot_cap: number | null
  guest_cap: number | null
  reveal_at: string | null  // ISO timestamp or null
}

export function useWizardState() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<Partial<WizardData>>({
    shot_cap: 10,
    guest_cap: 5,
    reveal_at: null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateField<K extends keyof WizardData>(key: K, value: WizardData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function nextStep() { setStep(s => Math.min(s + 1, 4)) }
  function prevStep() { setStep(s => Math.max(s - 1, 1)) }

  async function submit(): Promise<string | null> {
    if (isSubmitting) return null
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          event_date: data.event_date,
          shot_cap: data.shot_cap ?? null,
          guest_cap: data.guest_cap ?? null,
          reveal_at: data.reveal_at ?? null,
        }),
      })
      if (res.status === 402) {
        setError('Você atingiu o limite do seu plano.')
        return null
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Erro ao criar evento')
        return null
      }
      const body = await res.json()
      return body.slug as string
    } catch {
      setError('Sem conexão. Tente novamente.')
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  return { step, data, isSubmitting, error, updateField, nextStep, prevStep, submit, router }
}
