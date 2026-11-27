function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await sleep(1200);
    }

    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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
