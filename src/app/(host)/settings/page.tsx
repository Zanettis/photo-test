import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const initials = (user.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="px-6 pt-10 pb-4">
      <h1 className="text-2xl font-bold text-white mb-8">Configurações</h1>

      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center">
          <span className="text-white font-bold text-xl">{initials}</span>
        </div>
        <p className="text-zinc-400 text-sm">{user.email}</p>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <SignOutButton />
      </div>
    </div>
  )
}
