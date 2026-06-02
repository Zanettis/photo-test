'use client'
import { useEffect, useRef, useState } from 'react'

type Screen = 'camera' | 'uploading' | 'flash' | 'shot_cap' | 'closed' | 'countdown'

export function useCamera(screen: Screen) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    if (screen !== 'camera') {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setCameraReady(false)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Câmera não suportada neste browser.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraReady(true)
        setCameraError(null)
      })
      .catch(err => {
        const msg = (err as DOMException).name === 'NotAllowedError'
          ? 'Permissão negada. Use o botão abaixo para selecionar da galeria.'
          : 'Câmera indisponível. Use o botão abaixo para selecionar da galeria.'
        setCameraError(msg)
      })
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [screen])

  return { videoRef, cameraReady, cameraError }
}
