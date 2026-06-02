'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Calendar, Clock, Users, Camera, Lock, Trash2, Check } from 'lucide-react'
import { CoverPicker } from '@/components/wizard/cover-picker'
import { COVER_PRESETS } from '@/lib/cover-presets'
import { DeleteEventDialog } from '@/components/delete-event-dialog'
import { SettingsRow, SettingsToggleRow } from '@/components/settings-row'
import { SettingsSheet } from '@/components/settings-sheet'
import { GUEST_TIERS, unlimitedPhotosAddon, formatPrice } from '@/lib/pricing'
import { formatDateTimeShort } from '@/lib/date-utils'
import { useEventSettings } from '@/hooks/use-event-settings'

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

function fmtDate(iso: string | null): string {
  return iso ? formatDateTimeShort(iso) : ''
}

function guestLabel(cap: number | null): string {
  return cap === null ? 'Sem limite' : `Até ${cap} participantes`
}

function shotLabel(cap: number | null): string {
  return cap === null ? 'Ilimitado' : `${cap} fotos por pessoa`
}

export default function EventSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [event, setEvent] = useState<EventData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  function handleUpdate(updated: Partial<EventData>) {
    setEvent(prev => {
      if (!prev) return prev
      return {
        ...prev,
        ...updated,
        settings: (typeof updated.settings === 'object' && updated.settings !== null)
          ? updated.settings
          : prev.settings,
      }
    })
  }

  const s = useEventSettings(slug, handleUpdate)

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

  async function handleDeleteEvent() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/events/${slug}`, { method: 'DELETE' })
      if (res.ok) router.push('/dashboard')
      else s.setEditField(null)
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

      {s.error && <p className="text-red-400 text-sm mb-4">{s.error}</p>}

      <div className="bg-zinc-900 rounded-2xl overflow-hidden divide-y divide-zinc-800 mb-4">
        <SettingsRow icon={Pencil} label="Nome & Capa" value={event.name} onClick={() => s.openSheet('name_cover', event)} />
        <SettingsRow icon={Calendar} label="Data de encerramento" value={event.closes_at ? fmtDate(event.closes_at) : 'Sem data'} onClick={() => s.openSheet('closes_at', event)} />
        <SettingsRow icon={Clock} label="Data de revelação" value={event.reveal_at ? fmtDate(event.reveal_at) : 'Imediatamente'} onClick={() => s.openSheet('reveal_at', event)} />
        <SettingsRow icon={Users} label="Participantes" value={guestLabel(event.guest_cap)} badge={event.guest_cap === 5 ? 'Upgrade' : undefined} onClick={() => s.openSheet('guest_cap', event)} />
        <SettingsRow icon={Camera} label="Fotos por pessoa" value={shotLabel(event.shot_cap)} badge={event.shot_cap !== null ? 'Upgrade' : undefined} onClick={() => s.openSheet('shot_cap', event)} />
        <SettingsToggleRow icon={Lock} label="Todos veem todas as fotos" checked={publicGallery} onToggle={s.togglePublicGallery} disabled={s.isSaving} />
      </div>

      <div className="mt-8 pt-6 border-t border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-4">Zona de perigo</p>
        <button type="button" onClick={() => setShowDeleteDialog(true)} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-400 transition-colors">
          <Trash2 size={15} />
          Deletar este evento
        </button>
      </div>

      <SettingsSheet open={s.editField === 'name_cover'} onClose={() => s.setEditField(null)} title="Nome & Capa">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome do evento</label>
            <input
              type="text"
              value={s.draftName}
              onChange={e => s.setDraftName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Capa</label>
            <CoverPicker
              presetPaths={COVER_PRESETS}
              selected={s.draftCover}
              onSelectPreset={path => { s.setDraftCover(path); s.setDraftCoverFile(null) }}
              onSelectFile={(file, url) => { s.setDraftCoverFile(file); s.setDraftCover(url) }}
            />
          </div>
          <button type="button" onClick={s.saveNameCover} disabled={s.isSaving || !s.draftName.trim()} className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors mt-2">
            {s.isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SettingsSheet>

      <SettingsSheet open={s.editField === 'closes_at'} onClose={() => s.setEditField(null)} title="Data de encerramento">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={s.draftNoCloseDate} onChange={e => s.setDraftNoCloseDate(e.target.checked)} className="w-4 h-4 accent-white" />
            <span className="text-sm text-zinc-300">Sem data de encerramento</span>
          </label>
          {!s.draftNoCloseDate && (
            <input type="datetime-local" value={s.draftClosesAt} onChange={e => s.setDraftClosesAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors" />
          )}
          <button type="button" onClick={s.saveClosesAt} disabled={s.isSaving} className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors">
            {s.isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SettingsSheet>

      <SettingsSheet open={s.editField === 'reveal_at'} onClose={() => s.setEditField(null)} title="Data de revelação">
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={s.draftNoRevealDate} onChange={e => s.setDraftNoRevealDate(e.target.checked)} className="w-4 h-4 accent-white" />
            <span className="text-sm text-zinc-300">Revelar imediatamente</span>
          </label>
          {!s.draftNoRevealDate && (
            <input type="datetime-local" value={s.draftRevealAt} onChange={e => s.setDraftRevealAt(e.target.value)} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500 transition-colors" />
          )}
          <button type="button" onClick={s.saveRevealAt} disabled={s.isSaving} className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors">
            {s.isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </SettingsSheet>

      <SettingsSheet open={s.editField === 'guest_cap'} onClose={() => s.setEditField(null)} title="Participantes">
        <div className="space-y-2 mb-5">
          {GUEST_TIERS.map(tier => {
            const isSelected = s.draftGuestCap === tier.guest_cap
            return (
              <button key={String(tier.guest_cap)} type="button" onClick={() => s.setDraftGuestCap(tier.guest_cap)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${isSelected ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'}`}
              >
                <span className="flex-1 text-sm text-white text-left">
                  {tier.label} <span className="text-zinc-400">{tier.sublabel}</span>
                </span>
                <span className={`text-sm font-medium ${tier.price === 0 ? 'text-zinc-400' : 'text-amber-400'}`}>{formatPrice(tier.price)}</span>
                {isSelected && <Check size={16} className="text-white shrink-0" />}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={s.saveGuestCap} disabled={s.isSaving || s.draftGuestCap === event.guest_cap} className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors">
          {s.isSaving ? 'Salvando...' : 'Confirmar'}
        </button>
      </SettingsSheet>

      <SettingsSheet open={s.editField === 'shot_cap'} onClose={() => s.setEditField(null)} title="Fotos por pessoa">
        <div className="space-y-2 mb-5">
          {([5, 10, 20] as const).map(n => (
            <button key={n} type="button" onClick={() => s.setDraftShotCap(n)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${s.draftShotCap === n ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'}`}
            >
              <span className="flex-1 text-sm text-white text-left">{n} fotos por pessoa</span>
              {s.draftShotCap === n && <Check size={16} className="text-white shrink-0" />}
            </button>
          ))}
          <button type="button" onClick={() => s.setDraftShotCap(null)}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${s.draftShotCap === null ? 'border-white bg-zinc-800' : 'border-zinc-700 hover:border-zinc-500'}`}
          >
            <span className="flex-1 text-sm text-white text-left">Ilimitado</span>
            <span className="text-sm font-medium text-amber-400">+{formatPrice(addonPrice)}</span>
            {s.draftShotCap === null && <Check size={16} className="text-white shrink-0" />}
          </button>
        </div>
        <button type="button" onClick={s.saveShotCap} disabled={s.isSaving || s.draftShotCap === event.shot_cap} className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-100 disabled:opacity-50 transition-colors">
          {s.isSaving ? 'Salvando...' : 'Confirmar'}
        </button>
      </SettingsSheet>

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
