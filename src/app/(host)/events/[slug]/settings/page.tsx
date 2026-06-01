'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Calendar, Clock, Users, Camera, Lock, Trash2, Check } from 'lucide-react'
import { Dialog } from '@base-ui/react/dialog'
import { CoverPicker } from '@/components/wizard/cover-picker'
import { COVER_PRESETS } from '@/lib/cover-presets'
import { DeleteEventDialog } from '@/components/delete-event-dialog'
import { SettingsRow, SettingsToggleRow } from '@/components/settings-row'
import { GUEST_TIERS, unlimitedPhotosAddon, formatPrice } from '@/lib/pricing'

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
  if (!iso) return ''
  return iso.slice(0, 16)
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function guestLabel(cap: number | null): string {
  return cap === null ? 'Sem limite' : `Até ${cap} participantes`
}

function shotLabel(cap: number | null): string {
  return cap === null ? 'Ilimitado' : `${cap} fotos por pessoa`
}

function SheetWrapper({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Popup className="fixed z-50 bottom-0 inset-x-0 bg-zinc-950 border-t border-zinc-800 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <div className="p-6">
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-5" />
            <h2 className="text-white font-semibold text-lg mb-5">{title}</h2>
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default function EventSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [event, setEvent] = useState<EventData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editField, setEditField] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [draftName, setDraftName] = useState('')
  const [draftCover, setDraftCover] = useState<string | null>(null)
  const [draftCoverFile, setDraftCoverFile] = useState<File | null>(null)
  const [draftClosesAt, setDraftClosesAt] = useState('')
  const [draftNoCloseDate, setDraftNoCloseDate] = useState(false)
  const [draftRevealAt, setDraftRevealAt] = useState('')
  const [draftNoRevealDate, setDraftNoRevealDate] = useState(true)
  const [draftGuestCap, setDraftGuestCap] = useState<number | null>(5)
  const [draftShotCap, setDraftShotCap] = useState<number | null>(10)

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/events/${slug}/gallery`)
        if (!res.ok) { router.push('/dashboard'); return }
        const data = await res.json()
        const ev = data.event
        setEvent({
          ...ev,
          settings: (typeof ev.settings === 'object' && ev.settings !== null) ? ev.settings : {},
        })
      } catch {
        router.push('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [slug, router])

  function openSheet(field: string) {
    if (!event) return
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
        setEvent(prev => {
          if (!prev) return prev
          return {
            ...prev,
            ...data,
            settings: (typeof data.settings === 'object' && data.settings !== null)
              ? data.settings
              : prev.settings,
          }
        })
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

  async function handleSaveNameCover() {
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
    const ok = await patchEvent({ name: draftName, cover_image_path: finalCoverPath })
    if (ok) setEditField(null)
  }

  async function handleSaveClosesAt() {
    const ok = await patchEvent({ closes_at: draftNoCloseDate ? null : fromDatetimeLocal(draftClosesAt) })
    if (ok) setEditField(null)
  }

  async function handleSaveRevealAt() {
    const ok = await patchEvent({ reveal_at: draftNoRevealDate ? null : fromDatetimeLocal(draftRevealAt) })
    if (ok) setEditField(null)
  }

  async function handleSaveGuestCap() { if (await patchEvent({ guest_cap: draftGuestCap })) setEditField(null) }
  async function handleSaveShotCap() { if (await patchEvent({ shot_cap: draftShotCap })) setEditField(null) }
  async function handleTogglePublicGallery(value: boolean) { await patchEvent({ settings: { public_gallery: value } }) }

  async function handleDeleteEvent() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/events/${slug}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        setError('Não foi possível deletar o evento.')
        setShowDeleteDialog(false)
      }
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-lg">
        <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-6" />
        <div className="space-y-px">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-zinc-900 animate-pulse first:rounded-t-2xl last:rounded-b-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!event) return null

  const publicGallery = event.settings.public_gallery !== false
  const addonPrice = unlimitedPhotosAddon(event.guest_cap)

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <Link href={`/events/${slug}`} className="text-zinc-400 hover:text-white text-sm transition-colors">
          ← Voltar para galeria
        </Link>
        <h1 className="text-xl font-bold text-white mt-3">Configurações do evento</h1>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-zinc-900 rounded-2xl overflow-hidden divide-y divide-zinc-800 mb-4">
        <SettingsRow
          icon={Pencil}
          label="Nome & Capa"
          value={event.name}
          onClick={() => openSheet('name_cover')}
        />
        <SettingsRow
          icon={Calendar}
          label="Data de encerramento"
          value={event.closes_at ? fmtDate(event.closes_at) : 'Sem data'}
          onClick={() => openSheet('closes_at')}
        />
        <SettingsRow
          icon={Clock}
          label="Data de revelação"
          value={event.reveal_at ? fmtDate(event.reveal_at) : 'Imediatamente'}
          onClick={() => openSheet('reveal_at')}
        />
        <SettingsRow
          icon={Users}
          label="Participantes"
          value={guestLabel(event.guest_cap)}
          badge={event.guest_cap === 5 ? 'Upgrade' : undefined}
          onClick={() => openSheet('guest_cap')}
        />
        <SettingsRow
          icon={Camera}
          label="Fotos por pessoa"
          value={shotLabel(event.shot_cap)}
          badge={event.shot_cap !== null ? 'Upgrade' : undefined}
          onClick={() => openSheet('shot_cap')}
        />
        <SettingsToggleRow
          icon={Lock}
          label="Todos veem todas as fotos"
          checked={publicGallery}
          onToggle={handleTogglePublicGallery}
          disabled={isSaving}
        />
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-800">
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

      {/* Sheet: Nome & Capa */}
      <SheetWrapper open={editField === 'name_cover'} onClose={() => setEditField(null)} title="Nome & Capa">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome do evento</label>
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Capa</label>
            <CoverPicker
              presetPaths={COVER_PRESETS}
              selected={draftCover}
              onSelectPreset={(path) => { setDraftCover(path); setDraftCoverFile(null) }}
              onSelectFile={(file, blobUrl) => { setDraftCoverFile(file); setDraftCover(blobUrl) }}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveNameCover}
            disabled={isSaving || !draftName.trim()}
            className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors mt-2"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SheetWrapper>

      {/* Sheet: Data de encerramento */}
      <SheetWrapper open={editField === 'closes_at'} onClose={() => setEditField(null)} title="Data de encerramento">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draftNoCloseDate}
              onChange={e => setDraftNoCloseDate(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
            <span className="text-sm text-zinc-300">Sem data de encerramento</span>
          </label>
          {!draftNoCloseDate && (
            <input
              type="datetime-local"
              value={draftClosesAt}
              onChange={e => setDraftClosesAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors"
            />
          )}
          <button
            type="button"
            onClick={handleSaveClosesAt}
            disabled={isSaving}
            className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SheetWrapper>

      {/* Sheet: Data de revelação */}
      <SheetWrapper open={editField === 'reveal_at'} onClose={() => setEditField(null)} title="Data de revelação">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draftNoRevealDate}
              onChange={e => setDraftNoRevealDate(e.target.checked)}
              className="w-4 h-4 accent-white"
            />
            <span className="text-sm text-zinc-300">Revelar imediatamente</span>
          </label>
          {!draftNoRevealDate && (
            <input
              type="datetime-local"
              value={draftRevealAt}
              onChange={e => setDraftRevealAt(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors"
            />
          )}
          <button
            type="button"
            onClick={handleSaveRevealAt}
            disabled={isSaving}
            className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SheetWrapper>

      {/* Sheet: Participantes */}
      <SheetWrapper open={editField === 'guest_cap'} onClose={() => setEditField(null)} title="Participantes">
        <div className="space-y-2 mb-5">
          {GUEST_TIERS.map(tier => {
            const isSelected = draftGuestCap === tier.guest_cap
            return (
              <button
                key={String(tier.guest_cap)}
                type="button"
                onClick={() => setDraftGuestCap(tier.guest_cap)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${
                  isSelected
                    ? 'border-white bg-zinc-800'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <span className="flex-1 text-sm text-white text-left">
                  {tier.label} <span className="text-zinc-400">{tier.sublabel}</span>
                </span>
                <span className={`text-sm font-medium ${tier.price === 0 ? 'text-zinc-400' : 'text-amber-400'}`}>
                  {formatPrice(tier.price)}
                </span>
                {isSelected && <Check size={16} className="text-white shrink-0" />}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={handleSaveGuestCap}
          disabled={isSaving || draftGuestCap === event.guest_cap}
          className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Salvando...' : 'Confirmar'}
        </button>
      </SheetWrapper>

      {/* Sheet: Fotos por pessoa */}
      <SheetWrapper open={editField === 'shot_cap'} onClose={() => setEditField(null)} title="Fotos por pessoa">
        <div className="space-y-2 mb-5">
          {([5, 10, 20] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setDraftShotCap(n)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${
                draftShotCap === n
                  ? 'border-white bg-zinc-800'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <span className="flex-1 text-sm text-white text-left">{n} fotos por pessoa</span>
              {draftShotCap === n && <Check size={16} className="text-white shrink-0" />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDraftShotCap(null)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${
              draftShotCap === null
                ? 'border-white bg-zinc-800'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            <span className="flex-1 text-sm text-white text-left">Ilimitado</span>
            <span className="text-sm font-medium text-amber-400">+{formatPrice(addonPrice)}</span>
            {draftShotCap === null && <Check size={16} className="text-white shrink-0" />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSaveShotCap}
          disabled={isSaving || draftShotCap === event.shot_cap}
          className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Salvando...' : 'Confirmar'}
        </button>
      </SheetWrapper>

      <DeleteEventDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteEvent}
        isDeleting={isDeleting}
        eventName={event.name}
      />
    </div>
  )
}
