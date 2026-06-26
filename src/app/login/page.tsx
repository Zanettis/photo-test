'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleMagicLink(e: React.FormEvent) {
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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs flex flex-col items-center">
        {/* Brand */}
        <div className="mb-12 text-center">
          <div className="text-4xl mb-3">✳︎</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">foto.app</h1>
          <p className="text-sm text-zinc-500 mt-1">Capture momentos que importam</p>
        </div>

        {/* Auth options */}
        <div className="w-full space-y-3">
          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white text-black font-medium rounded-xl text-sm hover:bg-zinc-100 transition-colors"
          >
            <GoogleIcon />
            Entrar com Google
          </button>

          {/* Separator */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 border-t border-zinc-800" />
            <span className="text-xs text-zinc-600">ou</span>
            <div className="flex-1 border-t border-zinc-800" />
          </div>

          {/* Magic link */}
          {sent ? (
            <p className="text-green-400 text-sm text-center py-2">
              Link enviado! Verifique seu email — expira em 60 minutos.
            </p>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-2">
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                error={error || undefined}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-zinc-800 text-white text-sm font-medium rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Enviando...' : 'Enviar link de acesso'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}
