import { Dialog } from '@base-ui/react/dialog'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function SettingsSheet({ open, onClose, title, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Popup className="fixed z-50 bottom-0 inset-x-0 bg-zinc-950 border-t border-zinc-800 rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <div className="p-6">
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-5" />
            <h2 className="text-white font-semibold text-lg mb-5">{title}</h2>
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
