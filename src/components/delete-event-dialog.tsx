'use client'

import { Dialog } from '@base-ui/react/dialog'

interface DeleteEventDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  isDeleting: boolean
  eventName: string
}

export function DeleteEventDialog({ open, onClose, onConfirm, isDeleting, eventName }: DeleteEventDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen && !isDeleting) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-xl">
          <Dialog.Title className="text-white font-semibold text-lg mb-2">
            Deletar evento?
          </Dialog.Title>
          <Dialog.Description className="text-zinc-400 text-sm mb-6">
            Esta ação é permanente. O evento &ldquo;{eventName}&rdquo; e todas as suas fotos serão removidos.
          </Dialog.Description>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-sm border border-zinc-700 text-zinc-400 rounded-lg hover:text-white hover:border-zinc-500 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deletando...
                </>
              ) : 'Deletar'}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
