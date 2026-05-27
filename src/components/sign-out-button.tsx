'use client'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/login')
      }}
      className="text-sm text-zinc-400 hover:text-white transition-colors"
    >
      Sair
    </button>
  )
}
