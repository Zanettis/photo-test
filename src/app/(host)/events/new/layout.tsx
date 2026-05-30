// fullscreen layout — overrides HostLayout for the wizard
export default function NewEventLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0a0a0a]">{children}</div>
}
