export interface PhotoFilter {
  id: string
  label: string
  css: string
}

export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: 'none',      label: 'Original',   css: 'none' },
  { id: 'pb',        label: 'P&B',        css: 'grayscale(1)' },
  { id: 'sepia',     label: 'Sépia',      css: 'sepia(0.8)' },
  { id: 'vintage',   label: 'Vintage',    css: 'sepia(0.4) contrast(1.1) brightness(0.9) saturate(0.8)' },
  { id: 'vivido',    label: 'Vívido',     css: 'saturate(1.6) contrast(1.1)' },
  { id: 'frio',      label: 'Frio',       css: 'hue-rotate(195deg) saturate(0.9) brightness(1.05)' },
  { id: 'quente',    label: 'Quente',     css: 'sepia(0.2) saturate(1.4) hue-rotate(-20deg) brightness(1.05)' },
  { id: 'desbotado', label: 'Desbotado',  css: 'brightness(1.1) contrast(0.8) saturate(0.6)' },
]

export function getFilterCss(id: string): string {
  return PHOTO_FILTERS.find(f => f.id === id)?.css ?? 'none'
}
