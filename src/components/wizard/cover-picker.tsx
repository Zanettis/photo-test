'use client'
import { useRef } from 'react'
import { Camera, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  presetPaths: string[]
  selected: string | null
  onSelectPreset: (path: string) => void
  onSelectFile: (file: File, blobUrl: string) => void
  mode?: 'grid' | 'sheet'
  onClose?: () => void
}

export function CoverPicker({ presetPaths, selected, onSelectPreset, onSelectFile, mode = 'grid', onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isCustomSelected = selected !== null && !presetPaths.includes(selected)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const blobUrl = URL.createObjectURL(file)
    onSelectFile(file, blobUrl)
    onClose?.()
  }

  const grid = (
    <div className="grid grid-cols-3 gap-2">
      {/* Upload from gallery */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'aspect-[3/4] rounded-xl flex flex-col items-center justify-center gap-1.5 border-2 transition-all relative overflow-hidden',
          isCustomSelected ? 'border-white' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
        )}
      >
        {isCustomSelected && selected ? (
          <>
            <img src={selected} className="absolute inset-0 w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <Check size={11} className="text-black" />
              </div>
            </div>
          </>
        ) : (
          <>
            <Camera size={18} className="text-zinc-400" />
            <span className="text-zinc-500 text-[10px]">Minha foto</span>
          </>
        )}
      </button>

      {presetPaths.map((path) => {
        const isSelected = selected === path
        return (
          <button
            key={path}
            type="button"
            onClick={() => { onSelectPreset(path); onClose?.() }}
            className={cn(
              'aspect-[3/4] rounded-xl overflow-hidden relative border-2 transition-all',
              isSelected ? 'border-white' : 'border-transparent'
            )}
          >
            <div className="absolute inset-0 bg-zinc-800" />
            <img
              src={path}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            {isSelected && (
              <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <Check size={11} className="text-black" />
                </div>
              </div>
            )}
          </button>
        )
      })}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )

  if (mode === 'grid') return grid

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* sheet */}
      <div className="relative bg-zinc-950 rounded-t-3xl px-6 pt-4 pb-8">
        {/* handle */}
        <div className="mx-auto w-10 h-1 bg-zinc-700 rounded-full mb-5" />

        <div className="flex items-center justify-between mb-4">
          <p className="text-white font-semibold text-base">Escolha uma capa</p>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center"
          >
            <X size={14} className="text-zinc-400" />
          </button>
        </div>

        {grid}
      </div>
    </div>
  )
}
