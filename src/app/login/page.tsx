'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-zinc-800 rounded-xl p-8 bg-zinc-900">
        <h1 className="text-2xl font-bold text-white mb-1">foto.app</h1>
        <p className="text-zinc-400 text-sm mb-6">Entre com seu email para continuar</p>
        {sent ? (
          <p className="text-green-400 text-sm">Verifique seu email. O link expira em 60 minutos.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-100 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Entrar com link mágico'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
