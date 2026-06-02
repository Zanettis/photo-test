'use client'
import { useEffect, useState, useCallback } from 'react'
import { nanoid } from 'nanoid'

type UploadResult =
  | { status: 'success'; shotsRemaining: number | null }
  | { status: 'shot_cap' }
  | { status: 'error'; message: string }

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

export function useUpload(slug: string) {
  const [uploaderToken, setUploaderToken] = useState<string | null>(null)
  const [shotsRemaining, setShotsRemaining] = useState<number | null>(null)

  useEffect(() => {
    const key = `uploader_token_${slug}`
    let token = localStorage.getItem(key)
    if (!token) { token = nanoid(8); localStorage.setItem(key, token) }
    setUploaderToken(token)
  }, [slug])

  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      return { status: 'error', message: 'Formato não suportado. Use JPEG ou PNG.' }
    }
    if (file.size > 52428800) {
      return { status: 'error', message: 'Foto muito grande. Máximo 50MB.' }
    }

    // Step 1: obtain presigned URL (single attempt — retrying creates duplicate DB rows)
    let upload_url: string
    let shots_remaining: number | null

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`/api/events/${slug}/upload-url`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploader_token: uploaderToken,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          guest_email: localStorage.getItem(`reveal_email_${slug}`) ?? undefined,
        }),
      })

      if (res.status === 429) {
        const body = await res.json()
        if (body.error === 'shot_cap_reached') return { status: 'shot_cap' }
        return { status: 'error', message: 'Muitas fotos enviadas. Tente mais tarde.' }
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return { status: 'error', message: body.error ?? 'Falha no envio. Tente novamente.' }
      }

      const data = await res.json()
      upload_url = data.upload_url
      shots_remaining = data.shots_remaining ?? null
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { status: 'error', message: 'Conexão lenta. Tente novamente.' }
      }
      return { status: 'error', message: 'Sem conexão. Tente novamente.' }
    } finally {
      clearTimeout(timeoutId)
    }

    // Step 2: upload to storage with exponential backoff retries
    const retryDelays = [1000, 3000, 7000]
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(retryDelays[attempt - 1])
      try {
        const uploadRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (uploadRes.ok) {
          setShotsRemaining(shots_remaining)
          return { status: 'success', shotsRemaining: shots_remaining }
        }
        if (attempt === 2) return { status: 'error', message: 'Falha no envio. Tente novamente.' }
      } catch {
        if (attempt === 2) return { status: 'error', message: 'Sem conexão. Tente novamente.' }
      }
    }

    return { status: 'error', message: 'Falha no envio. Tente novamente.' }
  }, [slug, uploaderToken])

  return { uploaderToken, shotsRemaining, upload }
}
