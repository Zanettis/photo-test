export interface GuestTier {
  guest_cap: number | null
  label: string
  sublabel: string
  price: number
}

export const GUEST_TIERS: GuestTier[] = [
  { guest_cap: 5,    label: 'Até 5',       sublabel: 'convidados',  price: 0 },
  { guest_cap: 10,   label: 'Até 10',      sublabel: 'convidados',  price: 9.99 },
  { guest_cap: 25,   label: 'Até 25',      sublabel: 'convidados',  price: 24.99 },
  { guest_cap: 50,   label: 'Até 50',      sublabel: 'convidados',  price: 44.99 },
  { guest_cap: 100,  label: 'Até 100',     sublabel: 'convidados',  price: 89.99 },
  { guest_cap: 150,  label: 'Até 150',     sublabel: 'convidados',  price: 129.99 },
  { guest_cap: 200,  label: 'Até 200',     sublabel: 'convidados',  price: 159.99 },
  { guest_cap: null, label: 'Sem limite',  sublabel: 'de convidados', price: 199.99 },
]

export const VALID_GUEST_CAPS = [5, 10, 25, 50, 100, 150, 200, null] as const

// Add-on price for unlimited photos (shot_cap = null)
export function unlimitedPhotosAddon(guest_cap: number | null): number {
  if (guest_cap !== null && guest_cap <= 50) return 19.99
  if (guest_cap !== null && guest_cap <= 200) return 49.99
  return 89.99
}

export function calcEventPrice(guest_cap: number | null, shot_cap: number | null): number {
  const tier = GUEST_TIERS.find(t => t.guest_cap === guest_cap)
  const base = tier?.price ?? 199.99
  const addon = shot_cap === null ? unlimitedPhotosAddon(guest_cap) : 0
  return Math.round((base + addon) * 100) / 100
}

export function formatPrice(price: number): string {
  if (price === 0) return 'Grátis'
  return `R$ ${price.toFixed(2).replace('.', ',')}`
}
