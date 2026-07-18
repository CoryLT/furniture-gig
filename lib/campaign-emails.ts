// ============================================================
// FlipWork — marketing email templates
// ============================================================
// Templates for promotional email campaigns. Kept in one place so
// the send route and the admin preview API render identical copy.
// ============================================================

import { getSiteUrl } from '@/lib/utils'

// Physical address for CAN-SPAM compliance. Every marketing email
// must include a real mailing address in the footer. Placeholder
// for now — Cory to update to his registered agent's address (or
// PO box) before the first campaign goes out.
export const BUSINESS_ADDRESS =
  'Groovy Greens, LLC · North Carolina, USA'

export interface FreeYearOfferInput {
  firstName?: string | null // 'Alex' or null / '' if unknown
  unsubscribeToken: string
}

// Returns the HTML + text bodies + subject for one recipient.
// Personalization is deliberately minimal (just first name if we
// have one) — sending a plain, honest-looking email lands in the
// inbox better than a heavy template.
export function renderFreeYearOffer({
  firstName,
  unsubscribeToken,
}: FreeYearOfferInput) {
  const site = getSiteUrl()
  const offerLink = `${site}/offer/free-year`
  const unsubLink = `${site}/unsubscribe/${unsubscribeToken}`

  const greeting = firstName?.trim() ? `Hey ${firstName.trim()},` : 'Hey,'
  const subject = 'One free year of FlipWork Pro — on the house'

  const html = `
<!doctype html>
<html>
<body style="margin:0;padding:0;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2b2b2b;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#faf7f2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #ecebe6;padding:32px;">
          <tr>
            <td style="font-size:14px;line-height:1.6;color:#2b2b2b;">
              <p style="margin:0 0 16px 0;">${greeting}</p>
              <p style="margin:0 0 16px 0;">
                Thanks for signing up for FlipWork. As a small thank-you, I'd like to give you
                <strong>a full year of FlipWork Pro on the house</strong> — the receipt scanner,
                tax-year summary, 1099 tracking, and unlimited pieces.
              </p>
              <p style="margin:0 0 24px 0;">
                No card required. If you love it after your free year, you can start paying then.
                If not, your account just goes back to Free.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:10px;background:#f28c1a;">
                    <a href="${offerLink}" style="display:inline-block;padding:14px 24px;color:#ffffff;font-weight:600;text-decoration:none;border-radius:10px;">
                      Activate my free year →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;color:#6b6b6b;font-size:13px;">
                Or paste this link into your browser:<br/>
                <a href="${offerLink}" style="color:#6b6b6b;">${offerLink}</a>
              </p>
              <p style="margin:24px 0 0 0;">
                — Cory<br/>
                <span style="color:#6b6b6b;">Founder, FlipWork</span>
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer: CAN-SPAM required address + one-click unsubscribe -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;padding:16px 32px;">
          <tr>
            <td style="font-size:12px;line-height:1.5;color:#8a8a8a;text-align:center;">
              ${BUSINESS_ADDRESS}<br/>
              You&rsquo;re receiving this because you have a FlipWork account.<br/>
              <a href="${unsubLink}" style="color:#8a8a8a;text-decoration:underline;">
                Unsubscribe from promotional email
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()

  const text = [
    greeting,
    '',
    `Thanks for signing up for FlipWork. As a small thank-you, I'd like to give you a full year of FlipWork Pro on the house — the receipt scanner, tax-year summary, 1099 tracking, and unlimited pieces.`,
    '',
    `No card required. If you love it after your free year, you can start paying then. If not, your account just goes back to Free.`,
    '',
    `Activate my free year: ${offerLink}`,
    '',
    `— Cory`,
    `Founder, FlipWork`,
    '',
    '---',
    BUSINESS_ADDRESS,
    `You're receiving this because you have a FlipWork account.`,
    `Unsubscribe: ${unsubLink}`,
  ].join('\n')

  return { subject, html, text }
}
