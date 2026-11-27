import { useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  SAMPLE_JOB_PRESETS,
  buildCoverLetterFromProfile,
  buildCvFromProfile,
} from '../data/presets';
import type {
  ApplicationStatus,
  ApplicationTone,
  CandidateProfile,
  DocumentTemplateConfig,
  OutputLanguage,
  TailoredCoverLetter,
  TailoredCv,
  TailoredPackage,
} from '../types/ausbildung';
import { postJson } from '../utils/api';
import { exportCombinedPdf } from '../utils/pdfExport';
import { CoverLetterSheet } from './CoverLetterSheet';
import { CvDocumentSheet } from './CvDocumentSheet';

type ResultSubTab = 'analysis' | 'cv' | 'letter';

interface TailorWorkspaceProps {
  profile: CandidateProfile;
  onUpdatePhoto: (photoUrl: string) => void;
  templateConfig: DocumentTemplateConfig;
  onChangeTemplateConfig: (next: DocumentTemplateConfig) => void;
  jobDescription: string;
  onChangeJobDescription: (val: string) => void;
  targetCompany: string;
  onChangeTargetCompany: (val: string) => void;
  targetRole: string;
  onChangeTargetRole: (val: string) => void;
  language: OutputLanguage;
  onChangeLanguage: (val: OutputLanguage) => void;
  tone: ApplicationTone;
  onChangeTone: (val: ApplicationTone) => void;
  activePackage: TailoredPackage | null;
  onChangePackage: (pkg: TailoredPackage | null) => void;
  activeAppId: string | null;
  activeStatus: ApplicationStatus;
  onChangeStatus: (status: ApplicationStatus) => void;
  onSaveApplication: () => void;
  onGoToProfile: () => void;
}

export function TailorWorkspace({
  profile,
  onUpdatePhoto,
  templateConfig,
  onChangeTemplateConfig,
  jobDescription,
  onChangeJobDescription,
  targetCompany,
  onChangeTargetCompany,
  targetRole,
  onChangeTargetRole,
  language,
  onChangeLanguage,
  tone,
  onChangeTone,
  activePackage,
  onChangePackage,
  activeAppId,
  activeStatus,
  onChangeStatus,
  onSaveApplication,
  onGoToProfile,
}: TailorWorkspaceProps) {
  const [subTab, setSubTab] = useState<ResultSubTab>('cv');
  const [inputExpanded, setInputExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isExportingCombined, setIsExportingCombined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [lastTailoredJobText, setLastTailoredJobText] = useState<string>('');
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const previewCv: TailoredCv =
    activePackage?.tailoredCv ?? buildCvFromProfile(profile, targetRole);
  const previewLetter: TailoredCoverLetter =
    activePackage?.tailoredCoverLetter ??
    buildCoverLetterFromProfile(profile, targetCompany, targetRole);
  const effectiveCompany =
    activePackage?.jobAnalysis.companyName || targetCompany || 'Ausbildung';
  const isPackageOutdated = Boolean(
    activePackage &&
      lastTailoredJobText &&
      jobDescription.trim() !== lastTailoredJobText.trim()
  );

  const handleTailor = async () => {
    if (!profile.fullName.trim()) {
      setError('يرجى إدخال اسمك وبياناتك في صفحة "ملفي الشخصي" أولاً.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('يرجى لصق نص إعلان التدريب المهني أولاً.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const data = await postJson<TailoredPackage>('/api/tailor', {
        profile,
        jobDescription,
        targetCompany: targetCompany.trim(),
        targetRole: targetRole.trim(),
        language,
        tone,
      });

      onChangePackage(data);
      setLastTailoredJobText(jobDescription);
      setInputExpanded(false);
      setSubTab('cv');
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تجهيز المستندات.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (customPrompt?: string) => {
    const instruction = (customPrompt ?? refineInstruction).trim();
    if (!instruction || !activePackage) return;

    setIsRefining(true);
    setError(null);
    try {
      const targetSection = subTab === 'cv' ? 'cv' : subTab === 'letter' ? 'coverLetter' : 'both';
      const data = await postJson<TailoredPackage>('/api/refine', {
        profile,
        jobDescription,
        currentPackage: activePackage,
        targetSection,
        instruction,
        language,
      });

      onChangePackage(data);
      if (!customPrompt) setRefineInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تعديل المستند.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleExportCombined = async () => {
    setIsExportingCombined(true);
    try {
      await exportCombinedPdf(
        previewCv,
        previewLetter,
        profile,
        templateConfig,
        effectiveCompany
      );
    } finally {
      setIsExportingCombined(false);
    }
  };

  const handleSave = () => {
    onSaveApplication();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const loadPreset = (presetId: string) => {
    const preset = SAMPLE_JOB_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChangeTargetCompany('');
    onChangeTargetRole('');
    onChangeJobDescription(preset.description);
    setError(null);
  };

  const inputClass =
    'mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600';

  return (
    <div className="space-y-6">
      {/* Simple 1-2 Step Guided Intro Banner */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg no-print">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-[#2A3B56]">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900 dark:text-[#EEF2F8]">
              تجهيز السيرة الذاتية ورسالة الدافع
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-0.5">
              الخطوة ١: الصق إعلان الوظيفة ← الخطوة ٢: اضغط زر التجهيز ليتم تعديل السيرة والرسالة
              وحفظها بصيغة PDF.
            </p>
          </div>
          {activePackage && (
            <button
              type="button"
              onClick={() => setInputExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-slate-50 dark:bg-[#1D2B42] hover:bg-slate-100 dark:hover:bg-[#243652] border border-slate-200 dark:border-[#2A3B56] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {inputExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  إخفاء نص الإعلان
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  تغيير إعلان الوظيفة
                </>
              )}
            </button>
          )}
        </div>

        {(inputExpanded || !activePackage) && (
          <div className="p-6 space-y-5">
            {!profile.fullName.trim() && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4">
                <span>
                  ملفك الشخصي فارغ حالياً. أضف اسمك وشهاداتك وخبراتك أولاً لتظهر في السيرة
                  الذاتية.
                </span>
                <button
                  type="button"
                  onClick={onGoToProfile}
                  className="text-xs font-semibold underline whitespace-nowrap shrink-0"
                >
                  فتح ملفي الشخصي
                </button>
              </div>
            )}

            {/* Quick Sample Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-[#9FB0C7] ml-1">
                أو جرّب إعلاناً جاهزاً:
              </span>
              {SAMPLE_JOB_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => loadPreset(preset.id)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-slate-50 dark:bg-[#1D2B42] hover:bg-slate-100 dark:hover:bg-[#243652] border border-slate-200 dark:border-[#2A3B56] rounded-md transition-colors whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                الصق هنا نص إعلان التدريب المهني (Ausbildung) من موقع الشركة أو Arbeitsagentur
              </span>
              <textarea
                rows={6}
                dir="auto"
                value={jobDescription}
                onChange={(e) => onChangeJobDescription(e.target.value)}
                placeholder="انسخ إعلان الوظيفة بالألمانية أو الإنجليزية والصقه هنا..."
                className="mt-1.5 w-full p-3.5 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-[#1D2B42]"
              />
            </label>

            {/* Optional Advanced Settings Accordion */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {showAdvanced
                  ? 'إخفاء الخيارات الإضافية'
                  : 'خيارات إضافية (تحديد اسم الشركة أو اللغة أو الأسلوب)'}
              </button>

              {showAdvanced && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-[#2A3B56]">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      اسم الشركة (اختياري)
                    </span>
                    <input
                      type="text"
                      value={targetCompany}
                      onChange={(e) => onChangeTargetCompany(e.target.value)}
                      placeholder="يُستخرج تلقائياً"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      المهنة المطلوبة (اختياري)
                    </span>
                    <input
                      type="text"
                      value={targetRole}
                      onChange={(e) => onChangeTargetRole(e.target.value)}
                      placeholder="تُستخرج تلقائياً"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      لغة المستندات
                    </span>
                    <select
                      value={language}
                      onChange={(e) => onChangeLanguage(e.target.value as OutputLanguage)}
                      className={inputClass}
                    >
                      <option value="de_with_notes">ألمانية + شرح بالعربية (موصى به)</option>
                      <option value="de">ألمانية فقط</option>
                      <option value="en">إنجليزية (للشركات الدولية)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      أسلوب الكتابة
                    </span>
                    <select
                      value={tone}
                      onChange={(e) => onChangeTone(e.target.value as ApplicationTone)}
                      className={inputClass}
                    >
                      <option value="modern">حديث وواضح</option>
                      <option value="classic">رسمي كلاسيكي</option>
                      <option value="technical">تقني وعملي</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg px-4 py-3 text-sm flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <p className="text-xs text-slate-500 dark:text-[#9FB0C7]">
                يعتمد على بيانات ({profile.fullName || 'غير محدد'}) الموجودة في ملفك الشخصي فقط.
              </p>
              <button
                type="button"
                onClick={handleTailor}
                disabled={isGenerating || !jobDescription.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري تحليل الإعلان وتجهيز الملفات...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    تحليل الإعلان وتجهيز السيرة والرسالة
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        {!(inputExpanded || !activePackage) && error && (
          <div className="px-6 py-4">
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg px-4 py-3 text-sm flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </section>

      {/* Loading banner */}
      {isGenerating && (
        <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-3 no-print">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-900 dark:text-[#EEF2F8]">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600 dark:text-teal-400" />
            <span>
              جاري قراءة متطلبات الشركة وإعادة صياغة السيرة الذاتية ورسالة الدافع لتناسب الوظيفة...
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="h-14 bg-slate-100 dark:bg-[#1D2B42] rounded animate-pulse" />
            <div className="h-14 bg-slate-100 dark:bg-[#1D2B42] rounded animate-pulse" />
            <div className="h-14 bg-slate-100 dark:bg-[#1D2B42] rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Outdated or Untailored Notice */}
      {isPackageOutdated && !isGenerating && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 no-print">
          <span className="text-sm font-medium">
            لقد قمت بتغيير نص إعلان الوظيفة. اضغط على الزر لتحديث السيرة الذاتية ورسالة الدافع حسب الإعلان الجديد:
          </span>
          <button
            type="button"
            onClick={handleTailor}
            disabled={isGenerating || !jobDescription.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            تحديث السيرة للإعلان الجديد
          </button>
        </div>
      )}

      {/* Tailored Role Summary & Save/Full-PDF Strip */}
      <div ref={resultsRef} />
      {activePackage && (
        <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-[#EEF2F8]">
              {activePackage.jobAnalysis.roleTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-[#9FB0C7] mt-1">
              <span className="font-medium text-slate-900 dark:text-[#EEF2F8]">
                {activePackage.jobAnalysis.companyName}
              </span>
              {activePackage.jobAnalysis.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{activePackage.jobAnalysis.location}</span>
                </>
              )}
              {activePackage.jobAnalysis.startDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    يبدأ: {activePackage.jobAnalysis.startDate}
                  </span>
                </>
              )}
              {activePackage.jobAnalysis.duration && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{activePackage.jobAnalysis.duration}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              aria-label="حالة الطلب"
              value={activeStatus}
              onChange={(e) => onChangeStatus(e.target.value as ApplicationStatus)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-800 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="draft">الحالة: مسودة</option>
              <option value="ready">الحالة: جاهز للإرسال</option>
              <option value="applied">الحالة: تم التقديم</option>
              <option value="interview">الحالة: مقابلة عمل</option>
            </select>

            <button
              type="button"
              onClick={handleExportCombined}
              disabled={isExportingCombined}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap"
            >
              {isExportingCombined ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              تحميل الملف الكامل PDF
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <BookmarkCheck className="h-4 w-4" />
              {justSaved ? 'تم الحفظ' : activeAppId ? 'تحديث المحفوظ' : 'حفظ الطلب'}
            </button>
          </div>
        </div>
      )}

      {/* Segmented Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-[#162133] border border-transparent dark:border-[#2A3B56] rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('cv')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'cv'
                ? 'bg-white dark:bg-[#2A3B56] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            السيرة الذاتية (Lebenslauf)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('letter')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'letter'
                ? 'bg-white dark:bg-[#2A3B56] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            رسالة الدافع (Anschreiben)
          </button>
          {activePackage && (
            <button
              type="button"
              onClick={() => setSubTab('analysis')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'analysis'
                  ? 'bg-white dark:bg-[#2A3B56] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              تحليل التطابق
            </button>
          )}
        </div>

        {!activePackage && (
          <button
            type="button"
            onClick={handleExportCombined}
            disabled={isExportingCombined}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#1D2B42] rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <FileDown className="h-3.5 w-3.5" />
            تحميل القالب الحالي PDF
          </button>
        )}
      </div>

      {/* Tab 1: Lebenslauf */}
      {subTab === 'cv' && (
        <div className="space-y-5">
          <CvDocumentSheet
            cv={previewCv}
            profile={profile}
            companyName={effectiveCompany}
            templateConfig={templateConfig}
            isTailored={Boolean(activePackage)}
            onChangeTemplateConfig={onChangeTemplateConfig}
            onUpdatePhoto={onUpdatePhoto}
            onUpdateCv={(nextCv) => {
              if (activePackage) {
                onChangePackage({ ...activePackage, tailoredCv: nextCv });
              }
            }}
          />

          {activePackage && (
            <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-4 max-w-[820px] mx-auto space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-[#EEF2F8]">
                  اطلب تعديلاً على السيرة الذاتية:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'اختصر النقاط لتكون أكثر وضوحاً',
                    'أبرز المواد الدراسية والدرجات',
                    'ركّز على العمل الجماعي والانضباط',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefine(quick)}
                      className="px-2.5 py-1 text-xs text-slate-700 dark:text-[#C5D1E0] bg-slate-50 dark:bg-[#1D2B42] hover:bg-slate-100 dark:hover:bg-[#243652] border border-slate-200 dark:border-[#2A3B56] rounded-md transition-colors disabled:opacity-50"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="مثال: أبرز خبرتي في الحاسوب واجعل النبذة في سطرين..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="button"
                  disabled={isRefining || !refineInstruction.trim()}
                  onClick={() => handleRefine()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isRefining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  تطبيق التعديل
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Anschreiben */}
      {subTab === 'letter' && (
        <div className="space-y-5">
          <CoverLetterSheet
            letter={previewLetter}
            companyName={effectiveCompany}
            templateConfig={templateConfig}
            isTailored={Boolean(activePackage)}
            onChangeTemplateConfig={onChangeTemplateConfig}
            onUpdateLetter={(nextLetter) => {
              if (activePackage) {
                onChangePackage({ ...activePackage, tailoredCoverLetter: nextLetter });
              }
            }}
          />

          {activePackage && (
            <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-4 max-w-[820px] mx-auto space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-[#EEF2F8]">
                  اطلب تعديلاً على رسالة الدافع:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'اجعل الرسالة أقصر لتناسب صفحة واحدة',
                    'اجعل المقدمة أكثر حماساً ومناسبة للشركة',
                    'أبرز مستواي في اللغة الألمانية ورغبتي في التعلم',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefine(quick)}
                      className="px-2.5 py-1 text-xs text-slate-700 dark:text-[#C5D1E0] bg-slate-50 dark:bg-[#1D2B42] hover:bg-slate-100 dark:hover:bg-[#243652] border border-slate-200 dark:border-[#2A3B56] rounded-md transition-colors disabled:opacity-50"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="مثال: أضف شغفي بالعمل الميداني في الفقرة الثانية..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="button"
                  disabled={isRefining || !refineInstruction.trim()}
                  onClick={() => handleRefine()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isRefining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  تطبيق التعديل
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Analysis & Match */}
      {subTab === 'analysis' && activePackage && (
        <div className="space-y-6">
          <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
              ملخص الوظيفة وأهم المتطلبات
            </h3>
            <p className="text-sm text-slate-700 dark:text-[#C5D1E0] leading-relaxed">
              {activePackage.jobAnalysis.overview}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-slate-200 dark:border-[#2A3B56] text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-[#9FB0C7] mb-1.5">
                  المهارات التقنية والدراسية
                </p>
                <p className="text-slate-800 dark:text-[#EEF2F8] leading-relaxed">
                  {activePackage.jobAnalysis.hardSkills.join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-[#9FB0C7] mb-1.5">
                  المهارات الشخصية
                </p>
                <p className="text-slate-800 dark:text-[#EEF2F8] leading-relaxed">
                  {activePackage.jobAnalysis.softSkills.join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-[#9FB0C7] mb-1.5">
                  متطلبات اللغة والتواصل
                </p>
                <p className="text-slate-800 dark:text-[#EEF2F8]">
                  {activePackage.jobAnalysis.languageRequirement || 'غير محدد'}
                </p>
                {activePackage.jobAnalysis.recipientContact && (
                  <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-1">
                    المسؤول: {activePackage.jobAnalysis.recipientContact}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2A3B56]">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
                مقارنة شروط الشركة مع ملفك الشخصي
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-0.5">
                يوضح لك كيف يطابق ملفك كل شرط من شروط الإعلان دون اختلاق خبرات غير حقيقية.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#2A3B56] bg-slate-50 dark:bg-[#1D2B42] text-xs font-medium text-slate-500 dark:text-[#9FB0C7]">
                    <th className="py-3 px-6">الشرط المطلوب</th>
                    <th className="py-3 px-4">التصنيف</th>
                    <th className="py-3 px-4">ما يقابله في ملفك</th>
                    <th className="py-3 px-6 text-left">التقييم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#2A3B56] text-sm">
                  {activePackage.jobAnalysis.requirementMatches.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#1D2B42]/60"
                    >
                      <td className="py-3 px-6 font-medium text-slate-900 dark:text-[#EEF2F8]">
                        {row.requirement}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-[#9FB0C7] whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-[#C5D1E0]">
                        {row.evidenceFromProfile}
                      </td>
                      <td className="py-3 px-6 text-left whitespace-nowrap">
                        {row.strength === 'strong' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            تطابق قوي
                          </span>
                        )}
                        {row.strength === 'transferable' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            خبرة مقاربة
                          </span>
                        )}
                        {row.strength === 'gap' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            نقطة ناقصة
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-[#EEF2F8] mb-3">
                أبرز التعديلات التي تمت على ملفك
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-[#C5D1E0] list-disc pr-4">
                {activePackage.tailoringNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </section>

            <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-[#EEF2F8] mb-3">
                نصائح ونقاط يفضل الانتباه لها
              </h3>
              {activePackage.jobAnalysis.gapsOrActionItems.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-[#9FB0C7]">
                  ملفك مناسب جداً لهذا الإعلان ولا توجد نواقص جوهرية.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700 dark:text-[#C5D1E0] list-disc pr-4">
                  {activePackage.jobAnalysis.gapsOrActionItems.map((gap, idx) => (
                    <li key={idx}>{gap}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
