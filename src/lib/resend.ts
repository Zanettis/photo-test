import { Resend } from 'resend'

// Lazy init: RESEND_API_KEY may be absent in test environments
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null
const FROM = process.env.RESEND_FROM ?? 'onboarding@resend.dev'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function sendHostClosureEmail(
  email: string,
  eventName: string,
  galleryUrl: string
): Promise<void> {
  if (!resend) {
    console.warn('[resend] RESEND_API_KEY not set — closure email skipped')
    return
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Seu evento "${escapeHtml(eventName)}" foi encerrado`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#111">Seu evento encerrou!</h2>
          <p style="color:#444;font-size:16px">
            As fotos do evento <strong>${escapeHtml(eventName)}</strong> já estão disponíveis na galeria.
          </p>
          <a href="${galleryUrl}"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#000;color:#fff;
                    text-decoration:none;border-radius:6px;font-size:15px">
            Acessar galeria
          </a>
          <p style="margin-top:32px;color:#888;font-size:13px">
            Você recebeu este e-mail porque é o organizador do evento ${escapeHtml(eventName)}.
          </p>
        </div>
      `,
    })
  } catch (err) {
    // Fire-and-forget — log but never surface to caller
    console.error('[resend] sendHostClosureEmail failed:', err)
  }
}

export async function sendHostNpsEmail(
  email: string,
  eventName: string
): Promise<void> {
  if (!resend) {
    console.warn('[resend] RESEND_API_KEY not set — NPS email skipped')
    return
  }
  const formUrl = 'https://forms.google.com'
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Como foi o ${escapeHtml(eventName)}? Deixe seu feedback`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#111">Como foi o ${escapeHtml(eventName)}?</h2>
          <p style="color:#444;font-size:16px">
            Adoraríamos saber sua experiência com a plataforma. Leva menos de 1 minuto.
          </p>
          <a href="${formUrl}"
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#000;color:#fff;
                    text-decoration:none;border-radius:6px;font-size:15px">
            Deixar feedback
          </a>
          <p style="margin-top:32px;color:#888;font-size:13px">
            Você recebeu este e-mail porque organizou o evento ${escapeHtml(eventName)}.
          </p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[resend] sendHostNpsEmail failed:', err)
  }
}
