'use client'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-black px-6">
      <p className="text-white text-sm">Algo deu errado.</p>
      {error?.message && (
        <p className="text-zinc-500 text-xs font-mono break-all max-w-xs text-center">{error.message}</p>
      )}
      <button onClick={reset} className="text-zinc-400 text-xs underline">
        Tentar novamente
      </button>
    </div>
  )
}
