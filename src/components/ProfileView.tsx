import { useRef, useState } from 'react';
import { Camera, Loader2, Plus, Trash2, Upload, User } from 'lucide-react';
import { EMPTY_PROFILE, SAMPLE_PROFILE } from '../data/presets';
import type {
  CandidateProfile,
  EducationItem,
  ExperienceItem,
  LanguageItem,
} from '../types/ausbildung';
import { postJson } from '../utils/api';

interface ProfileViewProps {
  profile: CandidateProfile;
  onChange: (next: CandidateProfile) => void;
  onGoToTailor: () => void;
}

async function resizeImageFileToDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة المختار.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('ملف الصورة غير صالح.'));
    el.src = rawUrl;
  });

  const maxDim = 560;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export function ProfileView({ profile, onChange, onGoToTailor }: ProfileViewProps) {
  const [showImport, setShowImport] = useState(false);
  const [rawCvText, setRawCvText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateField = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) => {
    onChange({ ...profile, [key]: value });
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      setPhotoLoadError(false);
      updateField('photoUrl', dataUrl);
      setStatusMessage('تم تحديث صورتك الشخصية في الملف الشخصي وقالب السيرة الذاتية.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'تعذر تحميل الصورة.');
    }
  };

  const addExperience = () => {
    const next: ExperienceItem = {
      id: `exp-${Date.now()}`,
      period: '',
      role: '',
      organization: '',
      location: '',
      highlights: '',
    };
    updateField('experience', [...profile.experience, next]);
  };

  const updateExperience = (id: string, patch: Partial<ExperienceItem>) => {
    updateField(
      'experience',
      profile.experience.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeExperience = (id: string) => {
    updateField(
      'experience',
      profile.experience.filter((item) => item.id !== id)
    );
  };

  const addEducation = () => {
    const next: EducationItem = {
      id: `edu-${Date.now()}`,
      period: '',
      degree: '',
      institution: '',
      location: '',
      details: '',
    };
    updateField('education', [...profile.education, next]);
  };

  const updateEducation = (id: string, patch: Partial<EducationItem>) => {
    updateField(
      'education',
      profile.education.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeEducation = (id: string) => {
    updateField(
      'education',
      profile.education.filter((item) => item.id !== id)
    );
  };

  const addLanguage = () => {
    const next: LanguageItem = {
      id: `lang-${Date.now()}`,
      language: '',
      level: 'B2',
    };
    updateField('languages', [...profile.languages, next]);
  };

  const updateLanguage = (id: string, patch: Partial<LanguageItem>) => {
    updateField(
      'languages',
      profile.languages.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeLanguage = (id: string) => {
    updateField(
      'languages',
      profile.languages.filter((item) => item.id !== id)
    );
  };

  const handleParseCv = async () => {
    if (!rawCvText.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setStatusMessage(null);
    try {
      const data = await postJson<{
        fullName?: string;
        email?: string;
        phone?: string;
        streetAddress?: string;
        postalCity?: string;
        birthInfo?: string;
        nationality?: string;
        availability?: string;
        linkedInOrPortfolio?: string;
        summary?: string;
        experience?: Omit<ExperienceItem, 'id'>[];
        education?: Omit<EducationItem, 'id'>[];
        skills?: string;
        languages?: Omit<LanguageItem, 'id'>[];
        interests?: string;
      }>('/api/parse-cv', { rawText: rawCvText });

      onChange({
        ...profile,
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        streetAddress: data.streetAddress || '',
        postalCity: data.postalCity || '',
        birthInfo: data.birthInfo || '',
        nationality: data.nationality || '',
        availability: data.availability || '',
        linkedInOrPortfolio: data.linkedInOrPortfolio || '',
        summary: data.summary || '',
        experience: Array.isArray(data.experience)
          ? data.experience.map((e, idx) => ({
              ...e,
              id: `exp-${Date.now()}-${idx}`,
            }))
          : [],
        education: Array.isArray(data.education)
          ? data.education.map((e, idx) => ({
              ...e,
              id: `edu-${Date.now()}-${idx}`,
            }))
          : [],
        skills: data.skills || '',
        languages: Array.isArray(data.languages)
          ? data.languages.map((l, idx) => ({
              ...l,
              id: `lang-${Date.now()}-${idx}`,
            }))
          : [],
        interests: data.interests || '',
      });
      setShowImport(false);
      setRawCvText('');
      setStatusMessage('تم استخراج بياناتك بنجاح. يمكنك مراجعتها وتعديل أي حقل بالأسفل.');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'تعذر تحليل السيرة الذاتية.');
    } finally {
      setIsParsing(false);
    }
  };

  const inputClass =
    'mt-1 w-full px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#EEF2F8]">
            ملفي الشخصي (بياناتي الأساسية)
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9FB0C7] mt-1">
            أدخل معلوماتك مرة واحدة فقط. سيستخدمها التطبيق لتجهيز السيرة الذاتية ورسالة الدافع
            بصدق ودون إضافة معلومات غير حقيقية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowImport((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#1D2B42] rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            لصق سيرة جاهزة
          </button>
          <button
            type="button"
            onClick={() => {
              setPhotoLoadError(false);
              onChange(SAMPLE_PROFILE);
              setStatusMessage('تم تحميل نموذج بيانات جاهز للتجربة.');
            }}
            className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#1D2B42] rounded-lg transition-colors whitespace-nowrap"
          >
            تحميل مثال جاهز
          </button>
          <button
            type="button"
            onClick={() => {
              setPhotoLoadError(false);
              onChange(EMPTY_PROFILE);
              setStatusMessage('تم مسح الحقول لتكتب بياناتك الخاصة من البداية.');
            }}
            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-[#9FB0C7] bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors whitespace-nowrap"
          >
            مسح الكل
          </button>
          <button
            type="button"
            onClick={onGoToTailor}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap"
          >
            الانتقال لتجهيز التقديم
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
          >
            إخفاء
          </button>
        </div>
      )}

      {showImport && (
        <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
                استيراد سريع من سيرتك الذاتية القديمة
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#9FB0C7] mt-0.5">
                انسخ نص سيرتك الذاتية (بالألمانية أو الإنجليزية أو العربية) والصقه هنا وسيقوم النظام
                بتعبئة الحقول تلقائياً.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              إغلاق
            </button>
          </div>
          <textarea
            rows={6}
            value={rawCvText}
            onChange={(e) => setRawCvText(e.target.value)}
            placeholder="الصق نص سيرتك الذاتية هنا..."
            className="w-full p-3 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          {parseError && <p className="text-sm text-red-600 dark:text-red-400">{parseError}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleParseCv}
              disabled={isParsing || !rawCvText.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {isParsing && <Loader2 className="h-4 w-4 animate-spin" />}
              {isParsing ? 'جاري استخراج البيانات...' : 'تعبئة الحقول تلقائياً'}
            </button>
          </div>
        </div>
      )}

      {/* Personal Details Section */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-5">
        <div className="border-b border-slate-200 dark:border-[#2A3B56] pb-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
            ١. المعلومات الشخصية والصورة
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-0.5">
            تظهر في أعلى السيرة الذاتية ورسالة الدافع (يفضّل كتابتها بالأحرف اللاتينية كما في جواز
            السفر).
          </p>
        </div>

        {/* Photo upload row */}
        <div className="flex flex-wrap items-center gap-5 pb-4 border-b border-slate-100 dark:border-[#24344D]">
          <div className="h-24 w-20 rounded-lg border border-slate-200 dark:border-[#2A3B56] bg-slate-100 dark:bg-[#1D2B42] overflow-hidden flex items-center justify-center shrink-0">
            {profile.photoUrl && !photoLoadError ? (
              <img
                src={profile.photoUrl}
                alt={profile.fullName || 'الصورة الشخصية'}
                referrerPolicy="no-referrer"
                onError={() => setPhotoLoadError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-[#EEF2F8]">
                الصورة الشخصية للسيرة الذاتية (اختيارية)
              </p>
              <p className="text-xs text-slate-500 dark:text-[#9FB0C7]">
                تضاف تلقائياً داخل قالب أوروباس وملف PDF عند تفعيلها.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  handlePhotoUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#243652] rounded-lg transition-colors"
              >
                <Camera className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                رفع صورة
              </button>
              {profile.photoUrl && (
                <button
                  type="button"
                  onClick={() => updateField('photoUrl', '')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-[#9FB0C7] hover:text-red-600 dark:hover:text-red-400 rounded-lg"
                >
                  حذف الصورة
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              الاسم الكامل
            </span>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="مثال: Ahmad Al-Mansoor"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              البريد الإلكتروني
            </span>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="name@example.de"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              رقم الهاتف
            </span>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+49 176 ..."
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              الشارع ورقم المنزل
            </span>
            <input
              type="text"
              value={profile.streetAddress}
              onChange={(e) => updateField('streetAddress', e.target.value)}
              placeholder="Schillerstraße 28"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              الرمز البريدي والمدينة
            </span>
            <input
              type="text"
              value={profile.postalCity}
              onChange={(e) => updateField('postalCity', e.target.value)}
              placeholder="40237 Düsseldorf"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              متى يمكنك البدء؟
            </span>
            <input
              type="text"
              value={profile.availability}
              onChange={(e) => updateField('availability', e.target.value)}
              placeholder="Ab 01.08.2027 / Sofort"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              تاريخ ومكان الميلاد (اختياري)
            </span>
            <input
              type="text"
              value={profile.birthInfo}
              onChange={(e) => updateField('birthInfo', e.target.value)}
              placeholder="14.05.2006 in ..."
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              الجنسية أو الإقامة (اختياري)
            </span>
            <input
              type="text"
              value={profile.nationality}
              onChange={(e) => updateField('nationality', e.target.value)}
              placeholder="Syrisch / Aufenthaltserlaubnis..."
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              رابط أعمال أو LinkedIn (اختياري)
            </span>
            <input
              type="text"
              value={profile.linkedInOrPortfolio}
              onChange={(e) => updateField('linkedInOrPortfolio', e.target.value)}
              placeholder="github.com/username"
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
            نبذة مختصرة عنك (يمكنك كتابتها بالعربية أو الألمانية)
          </span>
          <textarea
            rows={3}
            value={profile.summary}
            onChange={(e) => updateField('summary', e.target.value)}
            placeholder="اكتب باختصار عن دراستك واهتماماتك ونقاط قوتك..."
            className={inputClass}
          />
        </label>
      </section>

      {/* Experience & Internships Section */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A3B56] pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
              ٢. الخبرات العملية والتدريب والتطوع
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-0.5">
              أضف أي تدريب عملي (Praktikum) أو عمل جزئي أو نشاط تطوعي أو مشروع قمت به.
            </p>
          </div>
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة خبرة
          </button>
        </div>

        {profile.experience.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-[#9FB0C7] py-2">
            لا توجد خبرات مضافة حالياً. اضغط "إضافة خبرة" لإدخال تدريب أو عمل سابق.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-[#2A3B56]">
            {profile.experience.map((item) => (
              <div key={item.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      الفترة (من – إلى)
                    </span>
                    <input
                      type="text"
                      value={item.period}
                      onChange={(e) => updateExperience(item.id, { period: e.target.value })}
                      placeholder="03/2026 – 04/2026"
                      className={inputClass}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      المسمى أو النشاط
                    </span>
                    <input
                      type="text"
                      value={item.role}
                      onChange={(e) => updateExperience(item.id, { role: e.target.value })}
                      placeholder="Praktikum IT-Support / عمل جزئي..."
                      className={inputClass}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                        المدينة
                      </span>
                      <input
                        type="text"
                        value={item.location}
                        onChange={(e) => updateExperience(item.id, { location: e.target.value })}
                        placeholder="Düsseldorf"
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeExperience(item.id)}
                      aria-label="حذف الخبرة"
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      اسم الشركة أو المؤسسة
                    </span>
                    <input
                      type="text"
                      value={item.organization}
                      onChange={(e) => updateExperience(item.id, { organization: e.target.value })}
                      placeholder="RheinWerk Systems GmbH"
                      className={inputClass}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      ماذا فعلت وما الذي أنجزته؟
                    </span>
                    <input
                      type="text"
                      value={item.highlights}
                      onChange={(e) => updateExperience(item.id, { highlights: e.target.value })}
                      placeholder="المهام التي قمت بها والأدوات التي استخدمتها..."
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Education Section */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#2A3B56] pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
              ٣. التعليم والشهادات المدرسية
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-0.5">
              أضف شهادتك المدرسية (ثانوية عامة / بكالوريا / Realschulabschluss) والمواد القوية فيها.
            </p>
          </div>
          <button
            type="button"
            onClick={addEducation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة شهادة
          </button>
        </div>

        {profile.education.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-[#9FB0C7] py-2">
            لا توجد شهادات تعليمية مضافة بعد.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-[#2A3B56]">
            {profile.education.map((edu) => (
              <div key={edu.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      الفترة
                    </span>
                    <input
                      type="text"
                      value={edu.period}
                      onChange={(e) => updateEducation(edu.id, { period: e.target.value })}
                      placeholder="08/2021 – 06/2027"
                      className={inputClass}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      الشهادة أو المرحلة الدراسية
                    </span>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEducation(edu.id, { degree: e.target.value })}
                      placeholder="Mittlerer Schulabschluss / Abitur"
                      className={inputClass}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                        المدينة
                      </span>
                      <input
                        type="text"
                        value={edu.location}
                        onChange={(e) => updateEducation(edu.id, { location: e.target.value })}
                        placeholder="Düsseldorf"
                        className={inputClass}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      aria-label="حذف الشهادة"
                      className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      اسم المدرسة أو المعهد
                    </span>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => updateEducation(edu.id, { institution: e.target.value })}
                      placeholder="Goethe-Realschule"
                      className={inputClass}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                      أبرز المواد أو الدرجات
                    </span>
                    <input
                      type="text"
                      value={edu.details}
                      onChange={(e) => updateEducation(edu.id, { details: e.target.value })}
                      placeholder="الرياضيات، الحاسوب، اللغة الإنجليزية..."
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Skills, Languages & Interests */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-5">
        <div className="border-b border-slate-200 dark:border-[#2A3B56] pb-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-[#EEF2F8]">
            ٤. المهارات واللغات والهوايات
          </h2>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
            المهارات التقنية والشخصية (افصل بينها بفاصلة)
          </span>
          <textarea
            rows={2}
            value={profile.skills}
            onChange={(e) => updateField('skills', e.target.value)}
            placeholder="MS Office, Excel, Python, العمل الجماعي، الالتزام بالمواعيد..."
            className={inputClass}
          />
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
              اللغات والمستوى الأوروبي (A1 – C2)
            </span>
            <button
              type="button"
              onClick={addLanguage}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة لغة
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.languages.map((lang) => (
              <div key={lang.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={lang.language}
                  onChange={(e) => updateLanguage(lang.id, { language: e.target.value })}
                  placeholder="Deutsch"
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <input
                  type="text"
                  value={lang.level}
                  onChange={(e) => updateLanguage(lang.id, { level: e.target.value })}
                  placeholder="B2 / C1 / لغة أم"
                  className="w-44 px-3 py-2 text-sm bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.id)}
                  aria-label="حذف اللغة"
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
            الهوايات والاهتمامات (اختياري)
          </span>
          <input
            type="text"
            value={profile.interests}
            onChange={(e) => updateField('interests', e.target.value)}
            placeholder="كرة القدم، البرمجة، القراءة..."
            className={inputClass}
          />
        </label>
      </section>
    </div>
  );
}
