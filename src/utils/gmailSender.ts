export interface GmailAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

function encodeRfc2047Subject(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return wrapBase64(btoa(binary));
}

function wrapBase64(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export async function sendApplicationViaGmail(params: {
  accessToken: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  attachments: GmailAttachment[];
}): Promise<{ id: string }> {
  const to = sanitizeHeaderValue(params.toEmail);
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح للشركة قبل الإرسال.');
  }

  const boundary = `ausbildung_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const lines: string[] = [
    `To: ${to}`,
    `Subject: ${encodeRfc2047Subject(sanitizeHeaderValue(params.subject))}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    encodeUtf8Base64(params.bodyText),
    '',
  ];

  for (const att of params.attachments) {
    const safeName = sanitizeHeaderValue(att.filename).replace(/"/g, "'");
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${safeName}"`,
      `Content-Disposition: attachment; filename="${safeName}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrapBase64(att.contentBase64.replace(/\s+/g, '')),
      ''
    );
  }

  lines.push(`--${boundary}--`, '');
  const rawMime = lines.join('\r\n');
  const encodedRaw = toBase64Url(rawMime);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedRaw }),
  });

  if (response.status === 401 || response.status === 403) {
    const err = new Error(
      'انتهت صلاحية إذن Gmail أو يلزم منح صلاحية الإرسال. يرجى ربط Gmail والمحاولة مجدداً.'
    ) as Error & { authExpired?: boolean };
    err.authExpired = true;
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`تعذر إرسال البريد عبر Gmail (${response.status}): ${text.slice(0, 180)}`);
  }

  return (await response.json()) as { id: string };
}
