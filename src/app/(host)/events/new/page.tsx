'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWizardState } from '@/hooks/use-wizard-state'
import { COVER_PRESETS } from '@/lib/cover-presets'
import { StepName } from '@/components/wizard/steps/step-name'
import { StepDate } from '@/components/wizard/steps/step-date'
import { StepReveal } from '@/components/wizard/steps/step-reveal'
import { StepDesign } from '@/components/wizard/steps/step-design'
import { StepFilter } from '@/components/wizard/steps/step-filter'
import { StepPlan } from '@/components/wizard/steps/step-plan'

export default function NewEventPage() {
  const router = useRouter()
  const { step, data, error, updateField, nextStep, prevStep, submit } = useWizardState()

  // selectedCover and coverImageFile persist across steps 4→5 (selected in 4, uploaded in 5)
  const [selectedCover, setSelectedCover] = useState<string | null>(COVER_PRESETS[0] ?? null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [selectedFilter, setSelectedFilter] = useState('none')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const exit = () => router.push('/dashboard')

  function handleDateNext() {
    if (!data.event_date) return
    updateField('closes_at', new Date(data.event_date + 'T23:59:59').toISOString())
    nextStep()
  }

  function handleRevealNext(revealAt: string | null) {
    updateField('reveal_at', revealAt)
    nextStep()
  }

  async function handleSubmit() {
    if (!selectedCover || submitLoading) return
    setSubmitLoading(true)
    setSubmitError(null)

    const slug = await submit()
    if (!slug) { setSubmitLoading(false); return }

    try {
      let coverPath = selectedCover

      if (coverImageFile) {
        const ext = coverImageFile.type === 'image/png' ? 'png' : 'jpg'
        const coverRes = await fetch(`/api/events/${slug}/cover-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_ext: ext }),
        })
        if (!coverRes.ok) throw new Error()
        const { upload_url, storage_path } = await coverRes.json()

        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': coverImageFile.type },
          body: coverImageFile,
        })
        if (!uploadRes.ok) throw new Error()
        coverPath = storage_path
      }

      await fetch(`/api/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_image_path: coverPath, settings: { photo_filter: selectedFilter } }),
      })
      router.push(`/events/${slug}/share`)
    } catch {
      setSubmitError('Falha ao salvar a capa. Tente novamente.')
      setSubmitLoading(false)
    }
  }

  if (step === 1) return (
    <StepName
      name={data.name ?? ''}
      onChange={v => updateField('name', v)}
      onNext={nextStep}
      onExit={exit}
    />
  )

  if (step === 2) return (
    <StepDate
      eventDate={data.event_date ?? null}
      onChange={v => updateField('event_date', v)}
      onNext={handleDateNext}
      onBack={prevStep}
      onExit={exit}
    />
  )

  if (step === 3) return (
    <StepReveal
      closesAt={data.closes_at ?? null}
      onNext={handleRevealNext}
      onBack={prevStep}
      onExit={exit}
    />
  )

  if (step === 4) return (
    <StepDesign
      eventName={data.name ?? ''}
      eventDate={data.event_date ?? ''}
      shotCap={data.shot_cap ?? null}
      selectedCover={selectedCover}
      onSelectPreset={path => { setSelectedCover(path); setCoverImageFile(null) }}
      onSelectFile={(file, url) => { setCoverImageFile(file); setSelectedCover(url) }}
      onNext={nextStep}
      onBack={prevStep}
      onExit={exit}
    />
  )

  if (step === 5) return (
    <StepFilter
      selectedFilter={selectedFilter}
      previewImage={selectedCover}
      onSelect={setSelectedFilter}
      onNext={nextStep}
      onBack={prevStep}
      onExit={exit}
    />
  )

  return (
    <StepPlan
      guestCap={data.guest_cap !== undefined ? data.guest_cap : 5}
      shotCap={data.shot_cap ?? null}
      onChangeGuestCap={cap => updateField('guest_cap', cap)}
      onChangeShotCap={cap => updateField('shot_cap', cap)}
      onSubmit={handleSubmit}
      onBack={prevStep}
      onExit={exit}
      loading={submitLoading}
      error={submitError ?? error}
    />
  )
}
