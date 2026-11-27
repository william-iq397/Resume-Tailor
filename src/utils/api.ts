export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let parsed: unknown = null;

  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    const trimmed = rawText.trim().slice(0, 80);
    if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.startsWith('<html')) {
      throw new Error(
        `The server returned an HTML page instead of JSON (HTTP ${response.status}). Please retry or restart the server.`
      );
    }
    throw new Error(`Invalid JSON response from server (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const errMessage =
      parsed && typeof parsed === 'object' && 'error' in parsed && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `Request failed with status ${response.status}.`;
    throw new Error(errMessage);
  }

  return parsed as T;
}
