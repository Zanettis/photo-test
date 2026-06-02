const LOCALE = 'pt-BR'

// For date-only strings (YYYY-MM-DD): appends T12:00:00 to avoid timezone shifts
function dateOnly(iso: string): Date {
  return new Date(iso + 'T12:00:00')
}

// "15 de junho de 2026" — event cards, detail pages
export function formatEventDate(iso: string): string {
  try {
    return dateOnly(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return '' }
}

// "15 de jun. de 2026" — album rows, compact date+year
export function formatDateMedium(iso: string): string {
  try {
    return dateOnly(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

// "15 de jun." — phone mockup, no year
export function formatDateShort(iso: string): string {
  try {
    return dateOnly(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
  } catch { return '' }
}

// For datetime strings (full ISO): "15 de jun. de 2026, 14:00" — settings page
export function formatDateTimeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(LOCALE, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// For datetime strings (full ISO): "15 de junho, 14:00" — reveal date in onboarding
export function formatRevealDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(LOCALE, {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}
