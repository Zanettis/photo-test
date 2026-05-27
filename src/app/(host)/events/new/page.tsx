'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewEventPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [shotCap, setShotCap] = useState('20')
  const [revealAt, setRevealAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        event_date: eventDate,
        shot_cap: shotCap ? parseInt(shotCap) : null,
        reveal_at: revealAt || null,
      }),
    })
    setLoading(false)
    if (res.ok) { router.push('/dashboard'); return }
    const data = await res.json()
    setError(data.error ?? 'Erro ao criar evento')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-white mb-6">Novo Evento</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Nome do evento</label>
          <input type="text" required value={name} onChange={e => setName(e.target.value)}
            placeholder="Casamento Ana e Pedro"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Data do evento</label>
          <input type="date" required value={eventDate} onChange={e => setEventDate(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Limite de fotos por pessoa</label>
          <select value={shotCap} onChange={e => setShotCap(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
          >
            <option value="20">20 fotos (padrão)</option>
            <option value="10">10 fotos</option>
            <option value="5">5 fotos</option>
            <option value="">Sem limite</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Revelar galeria em (opcional)</label>
          <input type="datetime-local" value={revealAt} onChange={e => setRevealAt(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-zinc-500"
          />
          <p className="text-xs text-zinc-600 mt-1">Deixe em branco para revelar imediatamente</p>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Criando...' : 'Criar Evento'}
          </button>
          <Link href="/dashboard" className="px-4 py-2 border border-zinc-700 text-zinc-400 rounded-lg hover:text-white hover:border-zinc-500 transition-colors text-sm flex items-center">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
