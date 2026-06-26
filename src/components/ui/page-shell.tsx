import { cn } from "@/lib/utils"

interface PageShellProps {
  children: React.ReactNode
  className?: string
  /** Remove o pb-24 para páginas fullscreen (wizard, câmera) */
  fullscreen?: boolean
}

function PageShell({ children, className, fullscreen = false }: PageShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[#0a0a0a]",
        !fullscreen && "pb-24",
        className
      )}
    >
      {children}
    </div>
  )
}

export { PageShell }
