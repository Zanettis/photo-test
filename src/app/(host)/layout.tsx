import { BottomNav } from '@/components/bottom-nav'

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  )
}
