import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Compass,
  FileCheck2,
  FolderKanban,
  Mail,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { WorkspaceTab } from './Sidebar';

interface AppTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: WorkspaceTab) => void;
}

interface TutorialStep {
  title: string;
  subtitle: string;
  body: string[];
  targetTab?: WorkspaceTab;
  targetLabel?: string;
  icon: typeof Sparkles;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'أهلاً بك في مساعد أوسبيلدونغ',
    subtitle: 'الخطوة ١ من ٦ — نظرة سريعة والحصص المجانية',
    icon: Sparkles,
    body: [
      'هذا التطبيق يساعدك في البحث عن فرص التدريب المهني في ألمانيا (Ausbildung)، وتجهيز سيرة ذاتية ورسالة دافع متوافقة تماماً مع معايير الشركات الألمانية.',
      'عند تسجيل الدخول بحساب Google تحصل فوراً على ٣ محاولات مجانية لتجهيز السيرة والرسالة. وبعدها يمكنك تجديد الاشتراك عبر كود التفعيل.',
    ],
  },
  {
    title: 'ملفك الشخصي والشهادات الاختيارية',
    subtitle: 'الخطوة ٢ من ٦ — بياناتك الحقيقية فقط',
    icon: UserCheck,
    targetTab: 'profile',
    targetLabel: 'فتح ملفي الشخصي',
    body: [
      'ابدأ بإدخال اسمك، عنوانك، مستواك في اللغة الألمانية، دراستك وخبراتك في صفحة «ملفي الشخصي».',
      'في القسم ٥ يمكنك رفع «شهادة الثانوية» و«شهادة اللغة الألمانية» إذا كانتا جاهزتين لديك. إذا لم ترفع شهادة معينة فسيعتبر التطبيق أنها غير متوفرة ولن يذكرها في السيرة ولن يرفقها في البريد.',
    ],
  },
  {
    title: 'تجهيز السيرة الذاتية ورسالة الدافع',
    subtitle: 'الخطوة ٣ من ٦ — تعديل دقيق دون اختلاق',
    icon: FileCheck2,
    targetTab: 'tailor',
    targetLabel: 'فتح صفحة التجهيز',
    body: [
      'في صفحة «تجهيز التقديم» الصق نص أي إعلان تدريب مهني، وسيقوم النظام بتحليله وصياغة سيرة ذاتية (Lebenslauf) ورسالة دافع (Anschreiben) بالألمانية.',
      'يمكنك تعديل أي جملة يدوياً، أو طلب تعديل سريع، ثم حفظ الملف بصيغة PDF أو حفظه في أرشيف طلباتك.',
    ],
  },
  {
    title: 'البحث التلقائي وإشعارات الفرص عالية القبول',
    subtitle: 'الخطوة ٤ من ٦ — اكتشاف فرص جديدة ومطابقتها',
    icon: Bell,
    targetTab: 'finder',
    targetLabel: 'فتح البحث والتقديم التلقائي',
    body: [
      'في صفحة «البحث والتقديم التلقائي» يمكنك البحث مباشرة في فرص Ausbildung الحية في ألمانيا أو لصق رابط صفحة شركة.',
      'يقوم التطبيق بمقارنة كل فرصة مع ملفك وطلباتك المحفوظة. أي فرصة جديدة أو سابقة تحقق نسبة قبول ٧٠٪ فأكثر تظهر في جرس الإشعارات مع اسم الطلب المحفوظ الأقرب لها.',
    ],
  },
  {
    title: 'التقديم بضغطة زر عبر Gmail',
    subtitle: 'الخطوة ٥ من ٦ — مراجعة وإرسال مباشر',
    icon: Mail,
    targetTab: 'finder',
    targetLabel: 'تجربة التقديم عبر Gmail',
    body: [
      'عند اختيار أي فرصة والضغط على «تجهيز التقديم والإيميل»، يستخرج التطبيق بريد الشركة (إن وُجد)، ويكتب نص الإيميل بالألمانية، ويجهز مرفقات PDF مع الشهادات التي رفعتها فقط.',
      'لن يتم إرسال أي بريد تلقائياً دون علمك: ستظهر لك نافذة مراجعة نهائية تعرض البريد والمرفقات لتضغط «تأكيد وإرسال الآن».',
    ],
  },
  {
    title: 'طلباتي المحفوظة (محرك المطابقة الذكي)',
    subtitle: 'الخطوة ٦ من ٦ — حفظ تلقائي ومتابعة الحالة',
    icon: FolderKanban,
    targetTab: 'archive',
    targetLabel: 'فتح طلباتي المحفوظة',
    body: [
      'كل طلب تقوم بتجهيزه يُحفظ تلقائياً في «طلباتي المحفوظة» حتى تتمكن من فتحه لاحقاً أو تحديث حالته (مسودة، جاهز، تم التقديم، مقابلة عمل).',
      'كلما حفظت طلبات أكثر، أصبحت إشعارات التطابق في صفحة البحث أدق في ترشيح الفرص المشابهة لك. ويمكنك إعادة تشغيل هذا الشرح في أي وقت من زر «شرح التطبيق» في الأعلى.',
    ],
  },
];

export function AppTutorialModal({
  isOpen,
  onClose,
  onNavigateTab,
}: AppTutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[stepIndex];
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;
  const progressPct = Math.round(((stepIndex + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print"
      role="dialog"
      aria-modal="true"
      aria-label="دليل استخدام التطبيق"
    >
      <div className="w-full max-w-xl bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-[#1D2B42]">
          <div
            className="h-full bg-teal-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-200 dark:border-[#2A3B56]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-teal-700 dark:text-teal-300" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-teal-700 dark:text-teal-300">
                {step.subtitle}
              </p>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#EEF2F8]">
                {step.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الشرح"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3.5 text-sm text-slate-700 dark:text-[#C5D1E0] leading-relaxed">
          {step.body.map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}

          {step.targetTab && onNavigateTab && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onNavigateTab(step.targetTab!);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-950/80 transition-colors"
              >
                <Compass className="h-3.5 w-3.5" />
                {step.targetLabel || 'الانتقال الآن'}
              </button>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-[#121C2C] border-t border-slate-200 dark:border-[#2A3B56]">
          <div className="flex items-center gap-1.5">
            {TUTORIAL_STEPS.map((s, idx) => (
              <button
                key={s.title}
                type="button"
                aria-label={`الخطوة ${idx + 1}`}
                onClick={() => setStepIndex(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex
                    ? 'w-6 bg-teal-600'
                    : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-[#9FB0C7] hover:text-slate-800 dark:hover:text-white"
            >
              تخطي
            </button>

            {!isFirst && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-100 dark:hover:bg-[#243652] rounded-lg transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                السابق
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors"
              >
                إنهاء الجولة والبدء
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1))}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors"
              >
                التالي
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
