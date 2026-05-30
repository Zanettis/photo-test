'use client'

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-black">
      <p className="text-white text-sm">Algo deu errado.</p>
      <button onClick={reset} className="text-zinc-400 text-xs underline">
        Tentar novamente
      </button>
    </div>
  )
}
