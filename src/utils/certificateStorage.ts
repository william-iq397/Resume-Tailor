import type {
  CandidateCertificate,
  CandidateCertificatesMap,
  CertificateType,
} from '../types/ausbildung';

const DB_NAME = 'ausbildung_studio_certs_v1';
const STORE_NAME = 'certificates';
const LS_FALLBACK_KEY = 'ausbildung_studio_certs_meta_v1';

function openCertDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'type' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
  });
}

export async function loadCertificates(): Promise<CandidateCertificatesMap> {
  const empty: CandidateCertificatesMap = { high_school: null, german_cert: null };
  try {
    const db = await openCertDb();
    return await new Promise<CandidateCertificatesMap>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as CandidateCertificate[];
        const map: CandidateCertificatesMap = { high_school: null, german_cert: null };
        for (const item of items) {
          if (item.type === 'high_school' || item.type === 'german_cert') {
            map[item.type] = item;
          }
        }
        resolve(map);
      };
      req.onerror = () => resolve(empty);
    });
  } catch {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (raw) return { ...empty, ...(JSON.parse(raw) as Partial<CandidateCertificatesMap>) };
    } catch {
      // Ignore
    }
    return empty;
  }
}

export async function saveCertificate(cert: CandidateCertificate): Promise<void> {
  try {
    const db = await openCertDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(cert);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save certificate'));
    });
  } catch {
    const current = await loadCertificates();
    current[cert.type] = cert;
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(current));
  }
}

export async function deleteCertificate(type: CertificateType): Promise<void> {
  try {
    const db = await openCertDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(type);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to remove certificate'));
    });
  } catch {
    const current = await loadCertificates();
    current[type] = null;
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(current));
  }
}

export function fileToCertificate(
  file: File,
  type: CertificateType
): Promise<CandidateCertificate> {
  const maxBytes = 4 * 1024 * 1024; // 4 MB limit per certificate for reliable Gmail attachment
  if (file.size > maxBytes) {
    return Promise.reject(
      new Error('حجم الملف كبير جداً. الحد الأقصى المسموح به لكل شهادة هو 4 ميجابايت.')
    );
  }
  const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return Promise.reject(
      new Error('يرجى رفع الشهادة بصيغة PDF أو صورة (JPG / PNG / WebP).')
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const dataBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({
        type,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataBase64,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الشهادة.'));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getUploadedAnlagenLabels(certs: CandidateCertificatesMap): string[] {
  const labels: string[] = [];
  if (certs.high_school) labels.push('Schulzeugnis');
  if (certs.german_cert) labels.push('Deutsch-Zertifikat');
  return labels;
}
