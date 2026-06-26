import { cn } from "@/lib/utils"

interface SectionProps {
  title?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function Section({ title, action, children, className }: SectionProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && (
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export { Section }
