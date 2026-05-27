declare module 'qrcode' {
  interface QRCodeOptions {
    version?: number
    errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H'
    maskPattern?: number
    toSJISFunc?: (codePoint: string) => number
    margin?: number
    scale?: number
    small?: boolean
    width?: number
    color?: {
      dark?: string
      light?: string
    }
    type?: string
    rendererOpts?: {
      quality?: number
    }
  }

  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  function toDataURL(text: string, callback: (err: Error | null, url: string) => void): void
  function toDataURL(text: string, options: QRCodeOptions, callback: (err: Error | null, url: string) => void): void

  function toCanvas(canvasElement: HTMLCanvasElement, text: string, options?: QRCodeOptions): Promise<void>
  function toCanvas(canvasElement: HTMLCanvasElement, text: string, callback: (err: Error | null) => void): void
  function toCanvas(canvasElement: HTMLCanvasElement, text: string, options: QRCodeOptions, callback: (err: Error | null) => void): void

  function toString(text: string, options?: QRCodeOptions): Promise<string>
  function toString(text: string, callback: (err: Error | null, str: string) => void): void

  const _default: {
    toDataURL: typeof toDataURL
    toCanvas: typeof toCanvas
    toString: typeof toString
  }
  export = _default
}
