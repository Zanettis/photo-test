'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Film, Infinity, UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-zinc-800 flex items-center px-8 pt-2 pb-6">
      <Link
        href="/dashboard"
        className={cn(
          'flex flex-1 flex-col items-center gap-1 text-[10px] font-bold tracking-widest uppercase transition-colors',
          pathname === '/dashboard' ? 'text-white' : 'text-zinc-500'
        )}
      >
        <Film size={20} />
        <span>Films</span>
      </Link>

      <Link
        href="/tapes"
        className={cn(
          'flex flex-1 flex-col items-center gap-1 text-[10px] font-bold tracking-widest uppercase transition-colors',
          pathname === '/tapes' ? 'text-white' : 'text-zinc-500'
        )}
      >
        <Infinity size={20} />
        <span>Tapes</span>
      </Link>

      <Link
        href="/settings"
        className={cn(
          'flex flex-1 flex-col items-center gap-1 transition-colors',
          pathname === '/settings' ? 'text-white' : 'text-zinc-500'
        )}
        aria-label="Perfil"
      >
        <UserCircle size={22} />
      </Link>
    </nav>
  )
}
