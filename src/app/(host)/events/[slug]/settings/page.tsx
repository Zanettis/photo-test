'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { CoverPicker } from '@/components/wizard/cover-picker'
import { COVER_PRESETS } from '@/lib/cover-presets'
import { DeleteEventDialog } from '@/components/delete-event-dialog'

interface EventSettings {
  name: string
  closes_at: string | null
  reveal_at: string | null
  cover_image_path: string | null
}

// datetime-local value format: "YYYY-MM-DDTHH:MM"
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

export default function EventSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [name, setName] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [noCloseDate, setNoCloseDate] = useState(false)
  const [revealAt, setRevealAt] = useState('')
  const [noRevealDate, setNoRevealDate] = useState(true)
  const [selectedCover, setSelectedCover] = useState<string | null>(null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/events/${slug}/gallery`)
        if (!res.ok) { router.push('/dashboard'); return }
        const data = await res.json()
        const ev: EventSettings = data.event
        setName(ev.name)
        if (ev.closes_at) {
          setClosesAt(toDatetimeLocal(ev.closes_at))
          setNoCloseDate(false)
        } else {
          setClosesAt('')
          setNoCloseDate(true)
        }
        if (ev.reveal_at) {
          setRevealAt(toDatetimeLocal(ev.reveal_at))
          setNoRevealDate(false)
        } else {
          setRevealAt('')
          setNoRevealDate(true)
        }
        setSelectedCover(ev.cover_image_path ?? COVER_PRESETS[0])
      } catch {
        router.push('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [slug, router])

  async function handleDeleteEvent() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/events/${slug}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setError('Não foi possível deletar o evento. Tente novamente.')
        setShowDeleteDialog(false)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      const closes_at = noCloseDate ? null : fromDatetimeLocal(closesAt)

      let finalCoverPath: string | null = selectedCover ?? null
      if (coverImageFile && selectedCover) {
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
        finalCoverPath = storage_path
      }

      const res = await fetch(`/api/events/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          closes_at,
          reveal_at: noRevealDate ? null : fromDatetimeLocal(revealAt),
          cover_image_path: finalCoverPath,
        }),
      })
      if (res.ok) {
        router.push(`/events/${slug}`)
        return
      }
      const data = await res.json()
      setError(data.error ?? 'Erro ao salvar')
    } catch {
      setError('Erro de conexão')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-lg">
        <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="space-y-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-zinc-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link
          href={`/events/${slug}`}
          className="text-zinc-400 hover:text-white text-sm transition-colors"
        >
          ← Voltar para galeria
        </Link>
        <h1 className="text-xl font-bold text-white mt-3">Configurações do evento</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Nome do evento</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Capa do evento</label>
          <CoverPicker
            presetPaths={COVER_PRESETS}
            selected={selectedCover}
            onSelectPreset={(path) => { setSelectedCover(path); setCoverImageFile(null) }}
            onSelectFile={(file, blobUrl) => { setCoverImageFile(file); setSelectedCover(blobUrl) }}
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm text-zinc-400">Data de encerramento</label>
          </div>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={noCloseDate}
              onChange={e => setNoCloseDate(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
            <span className="text-sm text-zinc-400">Sem data de encerramento</span>
          </label>
          {!noCloseDate && (
            <input
              type="datetime-local"
              value={closesAt}
              onChange={e => setClosesAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors"
            />
          )}
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Data de revelação das fotos</label>
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={noRevealDate}
              onChange={e => setNoRevealDate(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
            <span className="text-sm text-zinc-400">Revelar imediatamente</span>
          </label>
          {!noRevealDate && (
            <input
              type="datetime-local"
              value={revealAt}
              onChange={e => setRevealAt(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors"
            />
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar configurações'}
          </button>
          <Link
            href={`/events/${slug}`}
            className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded-lg hover:text-white hover:border-zinc-500 transition-colors text-sm flex items-center"
          >
            Cancelar
          </Link>
        </div>
      </form>

      <div className="mt-10 pt-8 border-t border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-4">Zona de perigo</p>
        <button
          type="button"
          onClick={() => setShowDeleteDialog(true)}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400 transition-colors"
        >
          <Trash2 size={15} />
          Deletar este evento
        </button>
      </div>

      <DeleteEventDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteEvent}
        isDeleting={isDeleting}
        eventName={name}
      />
    </div>
  )
}
