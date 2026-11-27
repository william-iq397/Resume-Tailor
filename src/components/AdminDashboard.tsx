import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FREE_QUOTA_LIMIT, useAuth, type UserAccountDoc } from '../contexts/AuthContext';
import { OperationType, db, handleFirestoreError } from '../firebase';

interface LicenseCodeDoc {
  code: string;
  used: boolean;
  durationDays: number;
  note: string;
  createdBy: string;
  createdAt: Timestamp | null;
  usedBy: string | null;
  usedByEmail: string | null;
  usedAt: Timestamp | null;
}

function generateLicenseCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part(4)}-${part(4)}`;
}

function formatDateAr(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminDashboard() {
  const { firebaseUser, isSuperAdmin } = useAuth();
  const [codes, setCodes] = useState<LicenseCodeDoc[]>([]);
  const [users, setUsers] = useState<UserAccountDoc[]>([]);
  const [codeFilter, setCodeFilter] = useState<'all' | 'unused' | 'used'>('all');

  const [newCode, setNewCode] = useState(() => generateLicenseCode());
  const [durationDays, setDurationDays] = useState(30);
  const [note, setNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const codesQuery = query(collection(db, 'codes'), orderBy('createdAt', 'desc'));
    const unsubCodes = onSnapshot(
      codesQuery,
      (snap) => {
        setCodes(snap.docs.map((d) => d.data() as LicenseCodeDoc));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'codes');
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : 'تعذر تحميل جدول الأكواد.');
        }
      }
    );

    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserAccountDoc));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'users');
        } catch (e) {
          setErrorMsg(e instanceof Error ? e.message : 'تعذر تحميل جدول المستخدمين.');
        }
      }
    );

    return () => {
      unsubCodes();
      unsubUsers();
    };
  }, [isSuperAdmin]);

  const filteredCodes = useMemo(() => {
    if (codeFilter === 'unused') return codes.filter((c) => !c.used);
    if (codeFilter === 'used') return codes.filter((c) => c.used);
    return codes;
  }, [codes, codeFilter]);

  if (!isSuperAdmin || !firebaseUser) {
    return (
      <div className="bg-white dark:bg-[#162133] border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          هذه الصفحة مخصصة للمشرف العام فقط.
        </p>
      </div>
    );
  }

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newCode.trim().toUpperCase();
    if (!/^[A-Z0-9\-]{4,32}$/.test(cleaned)) {
      setErrorMsg('يجب أن يحتوي الكود على حروف إنجليزية كبيرة وأرقام وشرطة (-) فقط (4 إلى 32 حرفاً).');
      return;
    }

    const days = Math.max(1, Math.min(3650, Math.floor(Number(durationDays) || 30)));
    setIsCreating(true);
    setErrorMsg(null);
    setFeedback(null);

    const path = `codes/${cleaned}`;
    try {
      await setDoc(doc(db, 'codes', cleaned), {
        code: cleaned,
        used: false,
        durationDays: days,
        note: note.trim().slice(0, 200),
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        usedBy: null,
        usedByEmail: null,
        usedAt: null,
      });

      setFeedback(`تم إنشاء الكود ${cleaned} لمدة ${days} يوماً بنجاح. يمكنك نسخه وإرساله على واتساب.`);
      setNote('');
      setNewCode(generateLicenseCode());
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, path);
      } catch (formatted) {
        setErrorMsg(formatted instanceof Error ? formatted.message : 'تعذر إنشاء الكود.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyForWhatsapp = async (item: LicenseCodeDoc) => {
    const text = `كود التفعيل الخاص بك في مساعد أوسبيلدونغ:\n${item.code}\n(صالح لمدة ${item.durationDays} يوماً - يُستخدم لمرة واحدة فقط بعد تسجيل الدخول بحساب Google)`;
    await navigator.clipboard.writeText(text);
    setCopiedCode(item.code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleDeleteCode = async (codeId: string) => {
    const path = `codes/${codeId}`;
    try {
      await deleteDoc(doc(db, 'codes', codeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleExtendUser = async (user: UserAccountDoc, days: number) => {
    const baseMs =
      user.paidUntil && user.paidUntil.toMillis() > Date.now()
        ? user.paidUntil.toMillis()
        : Date.now();
    const nextDate = new Date(baseMs + days * 86400 * 1000);
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        paidUntil: Timestamp.fromDate(nextDate),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleRevokeUser = async (user: UserAccountDoc) => {
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        paidUntil: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const activeUsersCount = users.filter(
    (u) => u.role === 'super_admin' || (u.paidUntil && u.paidUntil.toMillis() > Date.now())
  ).length;
  const unusedCodesCount = codes.filter((c) => !c.used).length;

  const inputClass =
    'mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600';

  return (
    <div className="space-y-6">
      {/* Header & Summary Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 mb-1">
            <ShieldCheck className="h-4 w-4" />
            <span>لوحة المشرف العام ({firebaseUser.email})</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#EEF2F8]">
            إدارة المستخدمين وأكواد التفعيل
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9FB0C7] mt-1">
            أنشئ أكواد التفعيل لمرة واحدة، أرسلها للمشتركين عبر واتساب، وتابع حالة كل حساب.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg px-4 py-2.5 text-center min-w-[110px]">
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7]">المستخدمون</p>
            <p className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-[#EEF2F8]">
              {users.length}
            </p>
          </div>
          <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg px-4 py-2.5 text-center min-w-[110px]">
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7]">اشتراكات فعّالة</p>
            <p className="font-mono-tabular text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {activeUsersCount}
            </p>
          </div>
          <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg px-4 py-2.5 text-center min-w-[110px]">
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7]">أكواد متاحة</p>
            <p className="font-mono-tabular text-lg font-bold text-teal-700 dark:text-teal-300">
              {unusedCodesCount}
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-lg px-4 py-3 text-sm">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Create New Code Card */}
      <form
        onSubmit={handleCreateCode}
        className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#2A3B56] pb-3">
          <KeyRound className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
            إصدار كود تفعيل جديد (table: codes)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              الكود (مثال: K7P2-9XQ4)
            </span>
            <div className="flex gap-1.5 mt-1">
              <input
                type="text"
                dir="ltr"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 text-sm font-mono-tabular uppercase bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              <button
                type="button"
                onClick={() => setNewCode(generateLicenseCode())}
                title="توليد كود عشوائي"
                className="px-2.5 py-2 bg-slate-100 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-700 dark:text-[#EEF2F8] hover:bg-slate-200 dark:hover:bg-[#243652]"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              مدة الاشتراك بالأيام
            </span>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className={inputClass}
            >
              <option value={7}>7 أيام (أسبوع)</option>
              <option value={30}>30 يوماً (شهر)</option>
              <option value={90}>90 يوماً (3 أشهر)</option>
              <option value={180}>180 يوماً (6 أشهر)</option>
              <option value={365}>365 يوماً (سنة كاملة)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              ملاحظة (اسم العميل / واتساب)
            </span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: أحمد - دفع عبر واتساب"
              className={inputClass}
            />
          </label>

          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {isCreating ? 'جاري الحفظ...' : 'إضافة الكود'}
          </button>
        </div>
      </form>

      {/* Table 1: codes */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2A3B56] flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
            جدول الأكواد (codes)
          </h2>
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1D2B42] rounded-lg">
            {[
              { id: 'all', label: `الكل (${codes.length})` },
              { id: 'unused', label: `متاح (${unusedCodesCount})` },
              { id: 'used', label: `مستخدم (${codes.length - unusedCodesCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCodeFilter(tab.id as 'all' | 'unused' | 'used')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  codeFilter === tab.id
                    ? 'bg-white dark:bg-[#2A3B56] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-[#9FB0C7]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredCodes.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 dark:text-[#9FB0C7] text-center">
            لا توجد أكواد مطابقة حالياً.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2A3B56] bg-slate-50 dark:bg-[#1D2B42] text-xs font-medium text-slate-500 dark:text-[#9FB0C7]">
                  <th className="py-3 px-6">الكود</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">المدة</th>
                  <th className="py-3 px-4">ملاحظة</th>
                  <th className="py-3 px-4">استُخدم بواسطة</th>
                  <th className="py-3 px-6 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2A3B56] text-sm">
                {filteredCodes.map((item) => (
                  <tr key={item.code} className="hover:bg-slate-50/60 dark:hover:bg-[#1D2B42]/50">
                    <td className="py-3 px-6 font-mono-tabular font-semibold text-slate-900 dark:text-[#EEF2F8]" dir="ltr">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.used ? (
                        <span className="inline-flex px-2.5 py-0.5 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          مستخدم (used: true)
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-0.5 text-xs font-medium rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          متاح (used: false)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-700 dark:text-[#C5D1E0]">
                      {item.durationDays} يوم
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#9FB0C7]">
                      {item.note || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-[#9FB0C7]">
                      {item.used ? (
                        <div>
                          <p className="text-slate-800 dark:text-[#EEF2F8]">{item.usedByEmail || item.usedBy}</p>
                          <p className="text-[11px] text-slate-400">{formatDateAr(item.usedAt)}</p>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-6 text-left whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {!item.used && (
                          <button
                            type="button"
                            onClick={() => handleCopyForWhatsapp(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/50 rounded-md"
                          >
                            {copiedCode === item.code ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                نُسخ
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                نسخ للواتساب
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCode(item.code)}
                          aria-label="حذف الكود"
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Table 2: users */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2A3B56] flex items-center gap-2">
          <Users className="h-4 w-4 text-teal-700 dark:text-teal-300" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
            جدول المستخدمين (users)
          </h2>
        </div>

        {users.length === 0 ? (
          <p className="p-6 text-sm text-slate-500 dark:text-[#9FB0C7] text-center">
            لا يوجد مستخدمون مسجلون بعد.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2A3B56] bg-slate-50 dark:bg-[#1D2B42] text-xs font-medium text-slate-500 dark:text-[#9FB0C7]">
                  <th className="py-3 px-6">الاسم والبريد</th>
                  <th className="py-3 px-4">الدور</th>
                  <th className="py-3 px-4">الرصيد المجاني</th>
                  <th className="py-3 px-4">حالة الاشتراك (paidUntil)</th>
                  <th className="py-3 px-4">آخر كود</th>
                  <th className="py-3 px-6 text-left">إدارة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2A3B56] text-sm">
                {users.map((u) => {
                  const isActive =
                    u.role === 'super_admin' ||
                    (u.paidUntil != null && u.paidUntil.toMillis() > Date.now());
                  const usedFree = typeof u.freeUsed === 'number' ? u.freeUsed : 0;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/60 dark:hover:bg-[#1D2B42]/50">
                      <td className="py-3 px-6">
                        <p className="font-medium text-slate-900 dark:text-[#EEF2F8]">
                          {u.displayName || 'مستخدم'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-[#9FB0C7]">{u.email}</p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {u.role === 'super_admin' ? (
                          <span className="inline-flex px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold">
                            المشرف العام
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-[#9FB0C7]">مستخدم</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-700 dark:text-[#C5D1E0]">
                        {u.role === 'super_admin' ? '—' : `${usedFree} / ${FREE_QUOTA_LIMIT}`}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {u.role === 'super_admin' ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            وصول دائم
                          </span>
                        ) : isActive ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            فعّال حتى {formatDateAr(u.paidUntil)}
                          </span>
                        ) : usedFree < FREE_QUOTA_LIMIT ? (
                          <span className="text-teal-700 dark:text-teal-300 font-medium">
                            تجربة مجانية ({FREE_QUOTA_LIMIT - usedFree} متبقية)
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400">
                            {u.paidUntil
                              ? `منتهي (${formatDateAr(u.paidUntil)})`
                              : 'استنفد المجاني (LIMIT_REACHED)'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600 dark:text-[#9FB0C7]" dir="ltr">
                        {u.lastRedeemedCode || '—'}
                      </td>
                      <td className="py-3 px-6 text-left whitespace-nowrap">
                        {u.role !== 'super_admin' && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleExtendUser(u, 30)}
                              className="px-2.5 py-1 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 rounded-md"
                            >
                              +30 يوم
                            </button>
                            {u.paidUntil && (
                              <button
                                type="button"
                                onClick={() => handleRevokeUser(u)}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-md"
                              >
                                إيقاف
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
