function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postJson<T>(
  url: string,
  body: unknown,
  token?: string | null
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(1200);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers,
      body: JSON.stringify(body),
    });

    if (
      response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400) ||
      response.status === 401
    ) {
      throw new Error(
        'انتهت جلسة المعاينة أو يلزم إعادة التحقق من الحساب. يرجى تحديث الصفحة (Refresh) ثم المحاولة مرة أخرى.'
      );
    }

    const rawText = await response.text();
    const trimmed = rawText.trim();
    const isHtml =
      trimmed.slice(0, 120).toLowerCase().startsWith('<!doctype') ||
      trimmed.slice(0, 120).toLowerCase().startsWith('<html');

    if (isHtml || response.status === 502 || response.status === 504) {
      if (attempt === 0) {
        continue;
      }

      if (isHtml) {
        const isSpaFallback =
          trimmed.includes('id="root"') || trimmed.includes("id='root'");
        if (isSpaFallback) {
          throw new Error(
            `الخادم الخلفي غير متصل على هذا الرابط وأعاد صفحة التطبيق فقط (رمز ${response.status}). يرجى تحديث الصفحة أو التأكد من تشغيل الخادم الكامل (npm run dev).`
          );
        }
        throw new Error(
          `أعادت بوابة الاستضافة صفحة تحقق أو تحميل مؤقتة بدلاً من البيانات (رمز ${response.status}). يرجى تحديث الصفحة (Refresh) ثم إعادة المحاولة.`
        );
      }

      throw new Error(
        `انقطع الاتصال مؤقتاً بالخادم (رمز ${response.status}). يرجى المحاولة مرة أخرى.`
      );
    }

    let parsed: unknown = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`استجابة غير صالحة من الخادم (رمز ${response.status}).`);
    }

    if (!response.ok) {
      const errMessage =
        parsed &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof (parsed as { error?: unknown }).error === 'string'
          ? (parsed as { error: string }).error
          : `فشل الطلب برمز ${response.status}.`;
      throw new Error(errMessage);
    }

    return parsed as T;
  }

  throw new Error('تعذر إتمام الطلب. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
}

export async function getJson<T>(url: string, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'manual',
    headers,
  });

  if (
    response.type === 'opaqueredirect' ||
    (response.status >= 300 && response.status < 400) ||
    response.status === 401
  ) {
    throw new Error(
      'يرجى تسجيل الدخول بحساب Google أولاً أو تحديث الصفحة ثم المحاولة مجدداً.'
    );
  }

  const rawText = await response.text();
  const trimmed = rawText.trim();
  const isHtml =
    trimmed.slice(0, 120).toLowerCase().startsWith('<!doctype') ||
    trimmed.slice(0, 120).toLowerCase().startsWith('<html');

  if (isHtml) {
    throw new Error(`الخادم الخلفي أعاد استجابة غير متوقعة (رمز ${response.status}).`);
  }

  let parsed: unknown = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error(`استجابة غير صالحة من الخادم (رمز ${response.status}).`);
  }

  if (!response.ok) {
    const errMessage =
      parsed &&
      typeof parsed === 'object' &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `فشل الطلب برمز ${response.status}.`;
    throw new Error(errMessage);
  }

  return parsed as T;
}
