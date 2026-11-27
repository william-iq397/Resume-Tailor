import { useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileCheck2,
  Globe,
  Link2,
  Loader2,
  Mail,
  Paperclip,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type {
  ApplicationStatus,
  ApplicationTone,
  AusbildungOpportunity,
  CandidateCertificatesMap,
  CandidateProfile,
  DocumentTemplateConfig,
  OutputLanguage,
  PreparedEmailDraft,
  SavedApplication,
  TailoredPackage,
} from '../types/ausbildung';
import { getJson, postJson } from '../utils/api';
import { formatBytes, getUploadedAnlagenLabels } from '../utils/certificateStorage';
import { sendApplicationViaGmail, type GmailAttachment } from '../utils/gmailSender';
import { evaluateOpportunityMatch } from '../utils/matchingEngine';
import { generateCoverLetterPdfBase64, generateCvPdfBase64 } from '../utils/pdfExport';
import { LicenseGateCard } from './LicenseGateCard';

interface AusbildungFinderProps {
  profile: CandidateProfile;
  certificates: CandidateCertificatesMap;
  templateConfig: DocumentTemplateConfig;
  language: OutputLanguage;
  tone: ApplicationTone;
  savedApplications: SavedApplication[];
  discoveredOpportunities: AusbildungOpportunity[];
  selectedOpportunityId: string | null;
  onSelectOpportunityId: (id: string | null) => void;
  onMergeDiscoveredOpportunities: (items: AusbildungOpportunity[]) => void;
  onAutoSaveApplication: (
    pkg: TailoredPackage,
    jobDescription: string,
    status?: ApplicationStatus
  ) => SavedApplication;
  onUpdateSavedStatus: (id: string, status: ApplicationStatus) => void;
  onOpenInTailor: (
    pkg: TailoredPackage,
    jobDescription: string,
    savedAppId?: string
  ) => void;
  onRefreshNotifications: (opportunitiesOverride?: AusbildungOpportunity[]) => number;
  onGoToProfile: () => void;
  onGoToArchive: () => void;
}

interface PreparedOpportunityState {
  opportunityId: string;
  packageData: TailoredPackage;
  jobDescription: string;
  savedAppId: string;
  emailDraft: PreparedEmailDraft;
}

export function AusbildungFinder({
  profile,
  certificates,
  templateConfig,
  language,
  tone,
  savedApplications,
  discoveredOpportunities,
  selectedOpportunityId,
  onSelectOpportunityId,
  onMergeDiscoveredOpportunities,
  onAutoSaveApplication,
  onUpdateSavedStatus,
  onOpenInTailor,
  onRefreshNotifications,
  onGoToProfile,
  onGoToArchive,
}: AusbildungFinderProps) {
  const {
    firebaseUser,
    hasPaidAccess,
    freeRemaining,
    canGenerate,
    hasGmailAccess,
    connectGmail,
    getGmailAccessToken,
    consumeFreeGeneration,
    getIdToken,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('Fachinformatiker');
  const [searchCity, setSearchCity] = useState('');
  const [searchRadius, setSearchRadius] = useState('50');
  const [pasteUrl, setPasteUrl] = useState('');
  const [highMatchOnly, setHighMatchOnly] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [preparingOppId, setPreparingOppId] = useState<string | null>(null);
  const [isSendingGmail, setIsSendingGmail] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [preparedState, setPreparedState] = useState<PreparedOpportunityState | null>(null);
  const [sentSuccessMap, setSentSuccessMap] = useState<Record<string, boolean>>({});

  const evaluatedList = useMemo(() => {
    return discoveredOpportunities
      .map((opp) => ({
        opp,
        match: evaluateOpportunityMatch(opp, profile, savedApplications, certificates),
      }))
      .sort((a, b) => {
        if (selectedOpportunityId) {
          if (a.opp.id === selectedOpportunityId) return -1;
          if (b.opp.id === selectedOpportunityId) return 1;
        }
        return b.match.score - a.match.score;
      });
  }, [discoveredOpportunities, profile, savedApplications, certificates, selectedOpportunityId]);

  const visibleList = useMemo(() => {
    if (!highMatchOnly) return evaluatedList;
    return evaluatedList.filter((item) => item.match.isHighMatch);
  }, [evaluatedList, highMatchOnly]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!firebaseUser) {
      setError('يرجى تسجيل الدخول بحساب Google أولاً للبحث في فرص التدريب.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setStatusMessage(null);
    try {
      const token = await getIdToken();
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (searchCity.trim()) params.set('city', searchCity.trim());
      if (searchRadius) params.set('radius', searchRadius);

      const data = await getJson<{ total: number; items: AusbildungOpportunity[] }>(
        `/api/ausbildung/search?${params.toString()}`,
        token
      );

      onMergeDiscoveredOpportunities(data.items);
      const mergedPreview = [
        ...data.items,
        ...discoveredOpportunities.filter((old) => !data.items.some((n) => n.id === old.id)),
      ];
      const highCount = onRefreshNotifications(mergedPreview);
      setStatusMessage(
        `تم جلب ${data.items.length} فرصة تدريب من Arbeitsagentur. يوجد ${highCount} فرصة بنسبة قبول عالية (٧٠٪+).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر البحث عن الفرص حالياً.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      setError('يرجى تسجيل الدخول بحساب Google أولاً.');
      return;
    }
    if (!pasteUrl.trim()) {
      setError('يرجى لصق رابط صفحة إعلان التدريب المهني.');
      return;
    }

    setIsImportingUrl(true);
    setError(null);
    setStatusMessage(null);
    try {
      const token = await getIdToken();
      const fetched = await postJson<{
        title: string;
        description: string;
        detectedEmails: string[];
        externalUrl: string;
      }>('/api/ausbildung/fetch-url', { url: pasteUrl.trim() }, token);

      let hostname = 'موقع الشركة';
      try {
        hostname = new URL(fetched.externalUrl).hostname.replace(/^www\./, '');
      } catch {
        // Fallback
      }

      const newOpp: AusbildungOpportunity = {
        id: `url-${Date.now()}`,
        source: 'url',
        title: fetched.title || 'Ausbildungsangebot',
        occupation: fetched.title || 'Ausbildung',
        companyName: hostname,
        location: searchCity.trim() || 'Deutschland',
        externalUrl: fetched.externalUrl,
        description: fetched.description,
        detectedEmails: fetched.detectedEmails,
        companyEmail: fetched.detectedEmails[0] || '',
        firstSeenAt: new Date().toISOString(),
      };

      onMergeDiscoveredOpportunities([newOpp]);
      onSelectOpportunityId(newOpp.id);
      setPasteUrl('');
      onRefreshNotifications([newOpp, ...discoveredOpportunities]);
      setStatusMessage(
        fetched.detectedEmails.length > 0
          ? `تم استيراد الإعلان بنجاح واكتشاف بريد الشركة (${fetched.detectedEmails[0]}).`
          : 'تم استيراد نص الإعلان بنجاح. اضغط «تجهيز التقديم والإيميل» للمتابعة.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة محتوى الرابط.');
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handlePreparePackageAndEmail = async (opp: AusbildungOpportunity) => {
    if (!firebaseUser) {
      setError('يرجى تسجيل الدخول بحساب Google أولاً.');
      return;
    }
    if (!canGenerate) {
      setError(
        'LIMIT_REACHED: استنفدت المحاولات المجانية الـ 3 أو انتهى اشتراكك. أدخل كود تفعيل في البطاقة بالأعلى للمتابعة.'
      );
      return;
    }
    if (!profile.fullName.trim()) {
      setError('يرجى إكمال اسمك وبياناتك في صفحة «ملفي الشخصي» قبل تجهيز التقديم.');
      return;
    }

    setPreparingOppId(opp.id);
    onSelectOpportunityId(opp.id);
    setError(null);
    setStatusMessage(null);

    try {
      const token = await getIdToken();
      let fullDescription = opp.description || '';
      let detectedEmails = opp.detectedEmails || (opp.companyEmail ? [opp.companyEmail] : []);

      if (opp.source === 'arbeitsagentur' && opp.referenznummer && !fullDescription) {
        const detail = await getJson<{
          title: string;
          occupation: string;
          companyName: string;
          location: string;
          startDate: string;
          externalUrl: string;
          description: string;
          detectedEmails: string[];
        }>(`/api/ausbildung/detail?ref=${encodeURIComponent(opp.referenznummer)}`, token);

        fullDescription = detail.description;
        detectedEmails = detail.detectedEmails;

        onMergeDiscoveredOpportunities([
          {
            ...opp,
            description: detail.description,
            detectedEmails: detail.detectedEmails,
            companyEmail: detail.detectedEmails[0] || opp.companyEmail || '',
            externalUrl: detail.externalUrl || opp.externalUrl,
          },
        ]);
      }

      if (!fullDescription.trim()) {
        fullDescription = `Titel: ${opp.title}\nBeruf: ${opp.occupation}\nUnternehmen: ${opp.companyName}\nStandort: ${opp.location}`;
      }

      const tailored = await postJson<TailoredPackage>(
        '/api/tailor',
        {
          profile,
          jobDescription: fullDescription,
          targetCompany: opp.companyName,
          targetRole: opp.title,
          language,
          tone,
        },
        token
      );

      if (!hasPaidAccess && freeRemaining > 0) {
        await consumeFreeGeneration();
      }

      const savedApp = onAutoSaveApplication(tailored, fullDescription, 'ready');
      const certificateLabels = getUploadedAnlagenLabels(certificates);

      const emailDraftResp = await postJson<{
        companyEmail: string;
        subject: string;
        body: string;
      }>(
        '/api/ausbildung/prepare-email',
        {
          profile,
          tailoredPackage: tailored,
          jobDescription: fullDescription,
          detectedEmails,
          certificateLabels,
        },
        token
      );

      setPreparedState({
        opportunityId: opp.id,
        packageData: tailored,
        jobDescription: fullDescription,
        savedAppId: savedApp.id,
        emailDraft: {
          toEmail: emailDraftResp.companyEmail || detectedEmails[0] || '',
          subject: emailDraftResp.subject,
          body: emailDraftResp.body,
        },
      });
      setStatusMessage(
        'تم تجهيز السيرة ورسالة الدافع ونص الإيميل وحفظ الطلب تلقائياً في «طلباتي المحفوظة».'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تجهيز ملف التقديم.');
    } finally {
      setPreparingOppId(null);
    }
  };

  const handleOpenConfirmSend = () => {
    if (!preparedState) return;
    const to = preparedState.emailDraft.toEmail.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setError('يرجى كتابة البريد الإلكتروني الصحيح للشركة المستقبِلة قبل الإرسال.');
      return;
    }
    setError(null);
    setConfirmSendOpen(true);
  };

  const handleConfirmSendViaGmail = async () => {
    if (!preparedState) return;
    setIsSendingGmail(true);
    setError(null);

    try {
      let accessToken = getGmailAccessToken();
      if (!accessToken) {
        accessToken = await connectGmail();
      }

      const companyName =
        preparedState.packageData.jobAnalysis.companyName || 'Ausbildung';
      const [coverPdf, cvPdf] = await Promise.all([
        generateCoverLetterPdfBase64(
          preparedState.packageData.tailoredCoverLetter,
          templateConfig,
          companyName
        ),
        generateCvPdfBase64(
          preparedState.packageData.tailoredCv,
          profile,
          templateConfig,
          companyName,
          certificates
        ),
      ]);

      const attachments: GmailAttachment[] = [coverPdf, cvPdf];
      if (certificates.high_school) {
        attachments.push({
          filename: certificates.high_school.fileName || 'Schulzeugnis.pdf',
          mimeType: certificates.high_school.mimeType,
          contentBase64: certificates.high_school.dataBase64,
        });
      }
      if (certificates.german_cert) {
        attachments.push({
          filename: certificates.german_cert.fileName || 'Deutsch-Zertifikat.pdf',
          mimeType: certificates.german_cert.mimeType,
          contentBase64: certificates.german_cert.dataBase64,
        });
      }

      try {
        await sendApplicationViaGmail({
          accessToken,
          toEmail: preparedState.emailDraft.toEmail,
          subject: preparedState.emailDraft.subject,
          bodyText: preparedState.emailDraft.body,
          attachments,
        });
      } catch (sendErr) {
        const maybeExpired = sendErr as Error & { authExpired?: boolean };
        if (maybeExpired.authExpired) {
          const freshToken = await connectGmail();
          await sendApplicationViaGmail({
            accessToken: freshToken,
            toEmail: preparedState.emailDraft.toEmail,
            subject: preparedState.emailDraft.subject,
            bodyText: preparedState.emailDraft.body,
            attachments,
          });
        } else {
          throw sendErr;
        }
      }

      onUpdateSavedStatus(preparedState.savedAppId, 'applied');
      setSentSuccessMap((prev) => ({ ...prev, [preparedState.opportunityId]: true }));
      setConfirmSendOpen(false);
      setStatusMessage(
        `تم إرسال طلبك بنجاح عبر Gmail إلى ${preparedState.emailDraft.toEmail} وتحديث حالة الطلب إلى «تم التقديم».`
      );
    } catch (err) {
      setConfirmSendOpen(false);
      setError(err instanceof Error ? err.message : 'تعذر إرسال البريد عبر Gmail.');
    } finally {
      setIsSendingGmail(false);
    }
  };

  const uploadedCertsCount =
    (certificates.high_school ? 1 : 0) + (certificates.german_cert ? 1 : 0);

  return (
    <div className="space-y-6">
      <LicenseGateCard />

      {/* Header & Gmail Connection */}
      <section className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-[#EEF2F8] flex items-center gap-2">
              <Compass className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              البحث والتقديم التلقائي (المرحلة ١ و ٢)
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-1">
              ابحث في إعلانات التدريب المهني الألمانية، راجع نسبة القبول مقارنةً بطلباتك المحفوظة،
              جهّز السيرة ورسالة الدافع، وأرسل الإيميل عبر Gmail بضغطة زر.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const count = onRefreshNotifications();
                setStatusMessage(
                  `تم فحص جميع الفرص (${discoveredOpportunities.length}) مقابل طلباتك المحفوظة: تم العثور على ${count} فرصة بنسبة قبول ٧٠٪ فأكثر.`
                );
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-100 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap"
            >
              <BellRing className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              فحص وتحديث التنبيهات
            </button>

            <button
              type="button"
              onClick={() => void connectGmail()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                hasGmailAccess
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : 'bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white border-transparent'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              {hasGmailAccess ? 'Gmail متصل وجاهز للإرسال' : 'ربط Gmail للإرسال التلقائي'}
            </button>
          </div>
        </div>

        {/* Phase 1 Search Form */}
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 border-t border-slate-200 dark:border-[#2A3B56]"
        >
          <div className="md:col-span-5">
            <label className="block text-[11px] font-medium text-slate-600 dark:text-[#9FB0C7] mb-1">
              المهنة أو مجال التدريب (Ausbildung)
            </label>
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                dir="auto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="مثال: Pflegefachmann, Mechatroniker, Kaufmann..."
                className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-medium text-slate-600 dark:text-[#9FB0C7] mb-1">
              المدينة في ألمانيا (اختياري)
            </label>
            <input
              type="text"
              dir="auto"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="مثال: Berlin, München, Hamburg"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 dark:text-[#9FB0C7] mb-1">
              نطاق البحث
            </label>
            <select
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="25">25 كم</option>
              <option value="50">50 كم</option>
              <option value="100">100 كم</option>
              <option value="200">200 كم</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isSearching}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              بحث مباشر
            </button>
          </div>
        </form>

        {/* Direct URL Import Bar */}
        <form
          onSubmit={handleImportUrl}
          className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-200 dark:border-[#2A3B56]"
        >
          <div className="relative flex-1">
            <Link2 className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              dir="ltr"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="أو الصق رابط إعلان شركة مباشرة (https://...) لقراءته واستخراج البريد الإلكتروني"
              className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
          <button
            type="submit"
            disabled={isImportingUrl || !pasteUrl.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-[#EEF2F8] bg-slate-100 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-200 dark:hover:bg-[#243652] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {isImportingUrl ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            )}
            قراءة الرابط
          </button>
        </form>

        {/* Uploaded Certificates & Saved Apps summary strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-600 dark:text-[#9FB0C7]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              الطلبات المحفوظة للمقارنة:{' '}
              <strong className="font-mono-tabular text-slate-900 dark:text-[#EEF2F8]">
                {savedApplications.length}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              الشهادات المرفقة تلقائياً:{' '}
              <strong className="font-mono-tabular text-slate-900 dark:text-[#EEF2F8]">
                {uploadedCertsCount === 0
                  ? 'لا توجد شهادات مرفوعة (لن تُرفق في الإيميل)'
                  : getUploadedAnlagenLabels(certificates).join(' + ')}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToProfile}
            className="text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
          >
            إدارة الشهادات في ملفي الشخصي
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg px-4 py-3 text-sm flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-lg px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={onGoToArchive}
            className="text-xs font-semibold underline whitespace-nowrap shrink-0"
          >
            فتح طلباتي المحفوظة
          </button>
        </div>
      )}

      {/* Results + Phase 2 Prepared Email Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main List of Opportunities */}
        <div className={`${preparedState ? 'lg:col-span-6' : 'lg:col-span-12'} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-[#9FB0C7]">
              <span>
                الفرص المكتشفة:{' '}
                <strong className="font-mono-tabular text-slate-900 dark:text-[#EEF2F8]">
                  {visibleList.length}
                </strong>
              </span>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-[#C5D1E0] cursor-pointer">
              <input
                type="checkbox"
                checked={highMatchOnly}
                onChange={(e) => setHighMatchOnly(e.target.checked)}
                className="rounded border-slate-300 text-teal-600 focus:ring-teal-600"
              />
              عرض التطابقات العالية فقط (٧٠٪ فأكثر)
            </label>
          </div>

          {visibleList.length === 0 ? (
            <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-[#EEF2F8]">
                {discoveredOpportunities.length === 0
                  ? 'ابدأ بالبحث عن مهنة في ألمانيا أو الصق رابط شركة'
                  : 'لا توجد فرص تحقق شرط التطابق ٧٠٪+ حالياً'}
              </p>
              <p className="text-xs text-slate-500 dark:text-[#9FB0C7] max-w-md mx-auto">
                اضغط «بحث مباشر» لجلب أحدث إعلانات التدريب المهني من وكالة العمل الألمانية
                (Arbeitsagentur)، وسيتم تقييم كل فرصة تلقائياً مقارنةً بملفك وطلباتك المحفوظة.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleList.map(({ opp, match }) => {
                const isSelected = opp.id === selectedOpportunityId;
                const isPreparingThis = preparingOppId === opp.id;
                const isSent = Boolean(sentSuccessMap[opp.id]);

                return (
                  <article
                    key={opp.id}
                    className={`bg-white dark:bg-[#162133] border rounded-lg p-5 transition-colors ${
                      isSelected
                        ? 'border-teal-500 dark:border-teal-500 ring-1 ring-teal-500/30'
                        : 'border-slate-200 dark:border-[#2A3B56]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#EEF2F8]">
                          {opp.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-[#9FB0C7] mt-1">
                          <span className="font-medium text-slate-800 dark:text-[#EEF2F8]">
                            {opp.companyName}
                          </span>
                          {opp.location && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{opp.location}</span>
                            </>
                          )}
                          {opp.startDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">يبدأ: {opp.startDate}</span>
                            </>
                          )}
                          {opp.companyEmail && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span dir="ltr" className="font-mono-tabular text-teal-700 dark:text-teal-300">
                                {opp.companyEmail}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span
                          className={`font-mono-tabular text-sm font-bold ${
                            match.isHighMatch
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : match.score >= 50
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {match.score}% قبول تقديري
                        </span>
                        {isSent && (
                          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                            تم الإرسال عبر Gmail
                          </p>
                        )}
                      </div>
                    </div>

                    {match.matchedAppLabel && (
                      <p className="text-xs text-teal-800 dark:text-teal-300 mt-2.5">
                        الطلب المحفوظ الأقرب: <strong>{match.matchedAppLabel}</strong>
                      </p>
                    )}

                    {match.reasons.length > 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-[#9FB0C7] mt-1">
                        {match.reasons.join(' · ')}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-[#2A3B56]">
                      <div className="flex items-center gap-3">
                        {opp.externalUrl && (
                          <a
                            href={opp.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            عرض الإعلان الأصلي
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(preparingOppId)}
                        onClick={() => void handlePreparePackageAndEmail(opp)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {isPreparingThis ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            جاري التجهيز وقراءة الإيميل...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            تجهيز التقديم والإيميل
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Phase 2: Email Draft & One-Click Gmail Apply Drawer */}
        {preparedState && (
          <section className="lg:col-span-6 lg:sticky lg:top-6 bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#2A3B56]">
              <div>
                <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                  المرحلة ٢ — مراجعة الإيميل والمرفقات
                </p>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-[#EEF2F8] mt-0.5">
                  {preparedState.packageData.jobAnalysis.roleTitle} —{' '}
                  {preparedState.packageData.jobAnalysis.companyName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreparedState(null)}
                aria-label="إغلاق نافذة التجهيز"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                  البريد الإلكتروني للشركة المستهدفة (To)
                </span>
                <input
                  type="email"
                  dir="ltr"
                  value={preparedState.emailDraft.toEmail}
                  onChange={(e) =>
                    setPreparedState((prev) =>
                      prev
                        ? {
                            ...prev,
                            emailDraft: { ...prev.emailDraft, toEmail: e.target.value },
                          }
                        : null
                    )
                  }
                  placeholder="bewerbung@firma.de"
                  className={`mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600 ${
                    !preparedState.emailDraft.toEmail.trim()
                      ? 'border-amber-400 dark:border-amber-600'
                      : 'border-slate-200 dark:border-[#2A3B56]'
                  }`}
                />
                {!preparedState.emailDraft.toEmail.trim() && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 block">
                    لم يضع المعلن بريداً في نص الإعلان. انسخ بريد التوظيف من صفحة الشركة وضعه هنا.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                  عنوان الرسالة (Subject)
                </span>
                <input
                  type="text"
                  dir="ltr"
                  value={preparedState.emailDraft.subject}
                  onChange={(e) =>
                    setPreparedState((prev) =>
                      prev
                        ? {
                            ...prev,
                            emailDraft: { ...prev.emailDraft, subject: e.target.value },
                          }
                        : null
                    )
                  }
                  className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                  نص البريد الإلكتروني بالألمانية
                </span>
                <textarea
                  rows={7}
                  dir="ltr"
                  value={preparedState.emailDraft.body}
                  onChange={(e) =>
                    setPreparedState((prev) =>
                      prev
                        ? {
                            ...prev,
                            emailDraft: { ...prev.emailDraft, body: e.target.value },
                          }
                        : null
                    )
                  }
                  className="mt-1 w-full p-3 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] focus:outline-none focus:ring-2 focus:ring-teal-600 leading-relaxed"
                />
              </label>

              {/* Attachments summary */}
              <div className="bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-3.5 space-y-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-[#EEF2F8] flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  الملفات التي ستُرفق مع الرسالة:
                </p>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-[#C5D1E0]">
                  <li className="flex items-center justify-between">
                    <span dir="ltr">Anschreiben (PDF)</span>
                    <span className="text-emerald-700 dark:text-emerald-400">جاهز</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span dir="ltr">Lebenslauf (PDF)</span>
                    <span className="text-emerald-700 dark:text-emerald-400">جاهز</span>
                  </li>
                  {certificates.high_school ? (
                    <li className="flex items-center justify-between">
                      <span dir="ltr">{certificates.high_school.fileName}</span>
                      <span className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                        شهادة الثانوية ({formatBytes(certificates.high_school.sizeBytes)})
                      </span>
                    </li>
                  ) : (
                    <li className="text-[11px] text-slate-400 dark:text-slate-500">
                      شهادة الثانوية غير مرفوعة — لن تُرفق ولن تُذكر في السيرة
                    </li>
                  )}
                  {certificates.german_cert ? (
                    <li className="flex items-center justify-between">
                      <span dir="ltr">{certificates.german_cert.fileName}</span>
                      <span className="font-mono-tabular text-emerald-700 dark:text-emerald-400">
                        شهادة اللغة ({formatBytes(certificates.german_cert.sizeBytes)})
                      </span>
                    </li>
                  ) : (
                    <li className="text-[11px] text-slate-400 dark:text-slate-500">
                      شهادة اللغة غير مرفوعة — لن تُرفق ولن تُذكر في السيرة
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  onOpenInTailor(
                    preparedState.packageData,
                    preparedState.jobDescription,
                    preparedState.savedAppId
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                معاينة وتعديل السيرة
              </button>

              <button
                type="button"
                onClick={handleOpenConfirmSend}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                تقديم وإرسال عبر Gmail
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Mandatory Explicit Confirmation Modal Before Gmail Send */}
      {confirmSendOpen && preparedState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print"
          role="dialog"
          aria-modal="true"
          aria-label="تأكيد إرسال التقديم عبر Gmail"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2A3B56]">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-[#EEF2F8]">
                تأكيد إرسال البريد الإلكتروني
              </h3>
              <button
                type="button"
                onClick={() => setConfirmSendOpen(false)}
                disabled={isSendingGmail}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-3 text-xs text-slate-700 dark:text-[#C5D1E0]">
              <p>
                سيتم إرسال البريد التالي من حساب Gmail الخاص بك مع إرفاق ملفات PDF والشهادات
                المرفوعة فقط:
              </p>
              <div className="bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-3 space-y-1.5">
                <p>
                  <strong>إلى:</strong>{' '}
                  <span dir="ltr" className="font-mono-tabular">
                    {preparedState.emailDraft.toEmail}
                  </span>
                </p>
                <p>
                  <strong>الموضوع:</strong>{' '}
                  <span dir="ltr">{preparedState.emailDraft.subject}</span>
                </p>
                <p>
                  <strong>المرفقات:</strong>{' '}
                  <span dir="ltr">
                    {[
                      'Anschreiben.pdf',
                      'Lebenslauf.pdf',
                      certificates.high_school?.fileName,
                      certificates.german_cert?.fileName,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </p>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-[#9FB0C7]">
                تأكد من صحة عنوان البريد الإلكتروني قبل التأكيد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 dark:bg-[#121C2C] border-t border-slate-200 dark:border-[#2A3B56]">
              <button
                type="button"
                disabled={isSendingGmail}
                onClick={() => setConfirmSendOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg hover:bg-slate-100 dark:hover:bg-[#243652]"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSendingGmail}
                onClick={() => void handleConfirmSendViaGmail()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-50 rounded-lg transition-colors"
              >
                {isSendingGmail ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    جاري الإرسال عبر Gmail...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    تأكيد وإرسال الآن
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
