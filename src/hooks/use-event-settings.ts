'use client'
import { useState } from 'react'
import { COVER_PRESETS } from '@/lib/cover-presets'

interface EventData {
  id: string
  slug: string
  name: string
  event_date: string
  closes_at: string | null
  reveal_at: string | null
  cover_image_path: string | null
  guest_cap: number | null
  shot_cap: number | null
  settings: Record<string, unknown>
}

function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : ''
}

function fromDatetimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export function useEventSettings(slug: string, onUpdate: (updated: Partial<EventData>) => void) {
  const [editField, setEditField] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const [draftName, setDraftName] = useState('')
  const [draftCover, setDraftCover] = useState<string | null>(null)
  const [draftCoverFile, setDraftCoverFile] = useState<File | null>(null)
  const [draftClosesAt, setDraftClosesAt] = useState('')
  const [draftNoCloseDate, setDraftNoCloseDate] = useState(false)
  const [draftRevealAt, setDraftRevealAt] = useState('')
  const [draftNoRevealDate, setDraftNoRevealDate] = useState(true)
  const [draftGuestCap, setDraftGuestCap] = useState<number | null>(5)
  const [draftShotCap, setDraftShotCap] = useState<number | null>(10)

  function openSheet(field: string, event: EventData) {
    switch (field) {
      case 'name_cover':
        setDraftName(event.name)
        setDraftCover(event.cover_image_path ?? COVER_PRESETS[0])
        setDraftCoverFile(null)
        break
      case 'closes_at':
        setDraftClosesAt(toDatetimeLocal(event.closes_at))
        setDraftNoCloseDate(!event.closes_at)
        break
      case 'reveal_at':
        setDraftRevealAt(toDatetimeLocal(event.reveal_at))
        setDraftNoRevealDate(!event.reveal_at)
        break
      case 'guest_cap':
        setDraftGuestCap(event.guest_cap)
        break
      case 'shot_cap':
        setDraftShotCap(event.shot_cap)
        break
    }
    setEditField(field)
  }

  async function patchEvent(body: Record<string, unknown>): Promise<boolean> {
    setIsSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        onUpdate(data)
        return true
      }
      const data = await res.json()
      setError(data.error ?? 'Erro ao salvar')
      return false
    } catch {
      setError('Erro de conexão')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function saveNameCover() {
    let finalCoverPath = draftCover
    if (draftCoverFile && draftCover) {
      const ext = draftCoverFile.type === 'image/png' ? 'png' : 'jpg'
      const urlRes = await fetch(`/api/events/${slug}/cover-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ext: ext }),
      })
      if (!urlRes.ok) { setError('Erro no upload da capa'); return }
      const { upload_url, storage_path } = await urlRes.json()
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': draftCoverFile.type },
        body: draftCoverFile,
      })
      if (!uploadRes.ok) { setError('Falha no upload'); return }
      finalCoverPath = storage_path
    }
    if (await patchEvent({ name: draftName, cover_image_path: finalCoverPath })) setEditField(null)
  }

  async function saveClosesAt() {
    if (await patchEvent({ closes_at: draftNoCloseDate ? null : fromDatetimeLocal(draftClosesAt) })) setEditField(null)
  }

  async function saveRevealAt() {
    if (await patchEvent({ reveal_at: draftNoRevealDate ? null : fromDatetimeLocal(draftRevealAt) })) setEditField(null)
  }

  async function saveGuestCap() {
    if (await patchEvent({ guest_cap: draftGuestCap })) setEditField(null)
  }

  async function saveShotCap() {
    if (await patchEvent({ shot_cap: draftShotCap })) setEditField(null)
  }

  async function togglePublicGallery(value: boolean) {
    await patchEvent({ settings: { public_gallery: value } })
  }

  return {
    editField, setEditField,
    isSaving, error,
    draftName, setDraftName,
    draftCover, setDraftCover, draftCoverFile, setDraftCoverFile,
    draftClosesAt, setDraftClosesAt, draftNoCloseDate, setDraftNoCloseDate,
    draftRevealAt, setDraftRevealAt, draftNoRevealDate, setDraftNoRevealDate,
    draftGuestCap, setDraftGuestCap,
    draftShotCap, setDraftShotCap,
    openSheet, saveNameCover, saveClosesAt, saveRevealAt, saveGuestCap, saveShotCap, togglePublicGallery,
  }
}
