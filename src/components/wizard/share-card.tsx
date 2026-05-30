'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Share2, Copy, Check } from 'lucide-react'

interface Props {
  eventName: string
  slug: string
}

export function ShareCard({ eventName, slug }: Props) {
  const link = `${process.env.NEXT_PUBLIC_APP_URL}/e/${slug}`
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(link, { width: 200, margin: 1 }).then(setQrDataUrl)
  }, [link])

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({
        title: eventName,
        text: `Tire uma foto no ${eventName}!`,
        url: link,
      }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="flex flex-col items-center gap-2">
        {qrDataUrl
          ? <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 rounded-xl" />
          : <div className="w-48 h-48 bg-zinc-800 rounded-xl animate-pulse" />
        }
        <button onClick={handleCopy} className="font-mono text-xs text-zinc-400 hover:text-white transition-colors break-all text-center px-2">
          {copied ? <span className="text-green-400 flex items-center gap-1"><Check size={12} /> Copiado!</span> : link.replace('https://', '')}
        </button>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black font-semibold rounded-2xl hover:bg-zinc-100 transition-colors"
        >
          <Share2 size={18} />
          Compartilhar com convidados
        </button>
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-800 text-white font-medium rounded-2xl hover:bg-zinc-700 transition-colors"
        >
          <Copy size={16} />
          {copied ? 'Copiado!' : 'Copiar link'}
        </button>
      </div>
    </div>
  )
}
