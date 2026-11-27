import { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, LogIn, Sparkles } from 'lucide-react';
import { FREE_QUOTA_LIMIT, useAuth } from '../contexts/AuthContext';

export function LicenseGateCard() {
  const {
    firebaseUser,
    userDoc,
    authReady,
    isSuperAdmin,
    hasPaidAccess,
    freeRemaining,
    authError,
    signInWithGoogle,
    redeemLicenseCode,
  } = useAuth();

  const [codeInput, setCodeInput] = useState('');
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  if (!authReady || isSuperAdmin) return null;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    setIsRedeeming(true);
    setRedeemError(null);
    setRedeemSuccess(null);
    try {
      const result = await redeemLicenseCode(codeInput);
      const formattedDate = result.paidUntilDate.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      setRedeemSuccess(
        `تم تفعيل اشتراكك بنجاح لمدة ${result.durationDays} يوماً (حتى ${formattedDate}).`
      );
      setCodeInput('');
      setShowRedeemForm(false);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'تعذر التحقق من كود التفعيل.');
    } finally {
      setIsRedeeming(false);
    }
  };

  if (!firebaseUser) {
    return (
      <section className="bg-white dark:bg-[#162133] border border-teal-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#EEF2F8]">
              سجّل الدخول بحساب Google واحصل على {FREE_QUOTA_LIMIT} محاولات مجانية
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#9FB0C7]">
              يحصل كل حساب جديد عند التسجيل على {FREE_QUOTA_LIMIT} سير ذاتية و{FREE_QUOTA_LIMIT} رسائل
              دافع مجاناً للتجربة، وبعدها يمكنك التجديد بكود التفعيل من واتساب.
            </p>
            {authError && (
              <p className="text-xs text-red-600 dark:text-red-400 pt-1">{authError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogIn className="h-4 w-4" />
            تسجيل الدخول بحساب Google
          </button>
        </div>
      </section>
    );
  }

  const isLimitReached = !hasPaidAccess && freeRemaining === 0;
  const formVisible = isLimitReached || showRedeemForm;
  const activeUntilLabel = userDoc?.paidUntil
    ? userDoc.paidUntil.toDate().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  return (
    <section
      className={`rounded-lg p-5 space-y-4 no-print border ${
        isLimitReached
          ? 'bg-amber-50/70 dark:bg-[#162133] border-amber-300 dark:border-amber-800'
          : 'bg-white dark:bg-[#162133] border-teal-200 dark:border-[#2A3B56]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {hasPaidAccess ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          ) : isLimitReached ? (
            <KeyRound className="h-5 w-5 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
          ) : (
            <Sparkles className="h-5 w-5 text-teal-700 dark:text-teal-300 mt-0.5 shrink-0" />
          )}
          <div>
            {hasPaidAccess ? (
              <>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#EEF2F8]">
                  الاشتراك فعّال حتى {activeUntilLabel}
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#9FB0C7] mt-0.5">
                  عند إدخال كود تجديد جديد قبل انتهاء الاشتراك، تُضاف الأيام الجديدة تلقائياً فوق
                  الرصيد المتبقي دون أي خسارة.
                </p>
              </>
            ) : freeRemaining > 0 ? (
              <>
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-[#EEF2F8]">
                  رصيد التجربة المجانية: متبقي {freeRemaining} من أصل {FREE_QUOTA_LIMIT} محاولات
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#9FB0C7] mt-0.5">
                  كل محاولة تجهّز لك سيرة ذاتية ورسالة دافع مخصصة للإعلان. يمكنك تفعيل كود اشتراك في
                  أي وقت.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#EEF2F8]">
                  {userDoc?.paidUntil
                    ? 'انتهى اشتراكك الحالي — يرجى التجديد للمتابعة'
                    : `استنفدت المحاولات المجانية الـ ${FREE_QUOTA_LIMIT} — أدخل كود التفعيل للمتابعة`}
                </h2>
                <p className="text-xs text-slate-700 dark:text-[#C5D1E0] mt-0.5">
                  سيرك الذاتية المحفوظة في المتصفح تبقى متاحة دائماً في &quot;طلباتي المحفوظة&quot;
                  ويمكنك تعديلها يدوياً وتصديرها PDF، بينما يتطلب إنشاء ملفات جديدة إدخال كود تفعيل
                  جديد من واتساب.
                </p>
              </>
            )}
          </div>
        </div>

        {!isLimitReached && (
          <button
            type="button"
            onClick={() => setShowRedeemForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {showRedeemForm
              ? 'إخفاء خانة الكود'
              : hasPaidAccess
              ? 'تمديد الاشتراك بكود جديد'
              : 'لدي كود تفعيل'}
          </button>
        )}
      </div>

      {redeemSuccess && (
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{redeemSuccess}</span>
        </div>
      )}

      {formVisible && (
        <form onSubmit={handleRedeem} className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-[#2A3B56]">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              dir="ltr"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="K7P2-9XQ4"
              className="flex-1 px-4 py-2.5 text-sm font-mono-tabular uppercase bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            <button
              type="submit"
              disabled={isRedeeming || !codeInput.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isRedeeming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحقق...
                </>
              ) : hasPaidAccess ? (
                'إضافة المدة للاشتراك'
              ) : (
                'تفعيل الكود الآن'
              )}
            </button>
          </div>

          {redeemError && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400">{redeemError}</p>
          )}
        </form>
      )}
    </section>
  );
}
