'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Film, Plus, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-zinc-800 flex items-center justify-around px-8 pt-2 pb-6">
      <Link
        href="/dashboard"
        className={cn(
          'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors',
          pathname === '/dashboard' ? 'text-white' : 'text-zinc-500'
        )}
      >
        <Film size={22} />
        <span>Films</span>
      </Link>

      <Link
        href="/events/new"
        className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl -mt-5"
        aria-label="Criar evento"
      >
        <Plus size={24} className="text-black" strokeWidth={2.5} />
      </Link>

      <Link
        href="/settings"
        className={cn(
          'flex flex-col items-center gap-1 text-[10px] font-medium transition-colors',
          pathname === '/settings' ? 'text-white' : 'text-zinc-500'
        )}
      >
        <Settings2 size={22} />
        <span>Setting</span>
      </Link>
    </nav>
  )
}
