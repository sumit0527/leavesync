export type EmailButton = {
  label: string;
  url: string;
  variant?: 'approve' | 'reject' | 'default';
};

export type EmailDetail = {
  label: string;
  value: string | number | null | undefined;
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function buildProfessionalEmail(params: {
  title: string;
  greeting?: string;
  intro: string;
  details?: EmailDetail[];
  note?: string;
  buttons?: EmailButton[];
  footer?: string;
}) {
  const detailsRows = (params.details ?? [])
    .map(
      (detail) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1ead8;color:#6b5f47;font-weight:600;width:38%;">${escapeHtml(detail.label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1ead8;color:#1f2937;">${escapeHtml(detail.value)}</td>
        </tr>`
    )
    .join('');

  const buttons = (params.buttons ?? [])
    .map((button) => {
      const background = button.variant === 'approve' ? '#15803d' : button.variant === 'reject' ? '#b91c1c' : '#a16207';
      return `<a href="${escapeHtml(button.url)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border-radius:10px;background:${background};color:white;text-decoration:none;font-weight:700;">${escapeHtml(button.label)}</a>`;
    })
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f4ea;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #eadfca;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(80,60,20,0.08);">
        <div style="padding:22px 26px;background:linear-gradient(135deg,#7c5a12,#d6a72a);color:white;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">leaveSYNC</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.25;">${escapeHtml(params.title)}</h1>
        </div>
        <div style="padding:26px;">
          ${params.greeting ? `<p style="margin:0 0 12px;font-size:16px;">${escapeHtml(params.greeting)}</p>` : ''}
          <p style="margin:0 0 18px;line-height:1.6;color:#374151;">${escapeHtml(params.intro)}</p>
          ${detailsRows ? `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #f1ead8;border-radius:12px;overflow:hidden;margin:18px 0;background:#fffdf7;">${detailsRows}</table>` : ''}
          ${params.note ? `<p style="margin:18px 0;padding:12px 14px;border-left:4px solid #d6a72a;background:#fff8df;color:#4b5563;line-height:1.55;">${escapeHtml(params.note)}</p>` : ''}
          ${buttons ? `<div style="margin-top:22px;">${buttons}</div>` : ''}
          <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">${escapeHtml(params.footer ?? 'This is an automated leaveSYNC notification. Please do not share action links with anyone.')}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function plainTextFromHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
