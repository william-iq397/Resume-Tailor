import { useCallback, useEffect, useState } from 'react';
import { HelpCircle, LogIn, LogOut, Menu, Moon, ShieldCheck, Sun } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { ApplicationsArchive } from './components/ApplicationsArchive';
import { AppTutorialModal } from './components/AppTutorialModal';
import { AusbildungFinder } from './components/AusbildungFinder';
import { NotificationBell } from './components/NotificationBell';
import { ProfileView } from './components/ProfileView';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TailorWorkspace } from './components/TailorWorkspace';
import { useAuth } from './contexts/AuthContext';
import {
  DEFAULT_TEMPLATE_CONFIG,
  SAMPLE_PROFILE,
} from './data/presets';
import type {
  ApplicationStatus,
  ApplicationTone,
  AusbildungOpportunity,
  CandidateCertificatesMap,
  CandidateProfile,
  CertificateType,
  DocumentTemplateConfig,
  MatchNotification,
  OutputLanguage,
  SavedApplication,
  TailoredCv,
  TailoredPackage,
} from './types/ausbildung';
import {
  deleteCertificate,
  fileToCertificate,
  loadCertificates,
  saveCertificate,
} from './utils/certificateStorage';
import { evaluateOpportunityMatch } from './utils/matchingEngine';

const PROFILE_STORAGE_KEY = 'ausbildung_studio_profile_v1';
const APPS_STORAGE_KEY = 'ausbildung_studio_apps_v1';
const TEMPLATE_STORAGE_KEY = 'ausbildung_studio_template_v1';
const THEME_STORAGE_KEY = 'ausbildung_studio_theme_v1';
const DISCOVERED_STORAGE_KEY = 'ausbildung_discovered_v1';
const NOTIFS_STORAGE_KEY = 'ausbildung_notifications_v1';
const TUTORIAL_SEEN_KEY = 'ausbildung_tutorial_seen_v1';

function loadStoredProfile(): CandidateProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      return { ...SAMPLE_PROFILE, ...(JSON.parse(raw) as Partial<CandidateProfile>) };
    }
  } catch {
    // Fallback to sample profile
  }
  return SAMPLE_PROFILE;
}

function loadStoredApplications(): SavedApplication[] {
  try {
    const raw = localStorage.getItem(APPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as SavedApplication[];
    }
  } catch {
    // Ignore invalid storage
  }
  return [];
}

function loadStoredTemplateConfig(): DocumentTemplateConfig {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DocumentTemplateConfig> & {
        templateId?: string;
        accent?: string;
      };
      const validTemplates = ['europass_ats', 'classic_berlin', 'minimalist_bauhaus'];
      const validAccents = ['europass', 'slate', 'pine', 'burgundy'];
      return {
        ...DEFAULT_TEMPLATE_CONFIG,
        ...parsed,
        templateId:
          parsed.templateId && validTemplates.includes(parsed.templateId)
            ? (parsed.templateId as DocumentTemplateConfig['templateId'])
            : DEFAULT_TEMPLATE_CONFIG.templateId,
        accent:
          parsed.accent && validAccents.includes(parsed.accent)
            ? (parsed.accent as DocumentTemplateConfig['accent'])
            : DEFAULT_TEMPLATE_CONFIG.accent,
      };
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_TEMPLATE_CONFIG;
}

function loadStoredTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore
  }
  return 'light';
}

function loadStoredOpportunities(): AusbildungOpportunity[] {
  try {
    const raw = localStorage.getItem(DISCOVERED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as AusbildungOpportunity[];
    }
  } catch {
    // Ignore
  }
  return [];
}

function loadStoredNotifications(): MatchNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as MatchNotification[];
    }
  } catch {
    // Ignore
  }
  return [];
}

export default function App() {
  const { firebaseUser, isSuperAdmin, signInWithGoogle, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(() => {
    const hash = window.location.hash.replace('#', '') as WorkspaceTab;
    if (
      hash === 'tailor' ||
      hash === 'finder' ||
      hash === 'profile' ||
      hash === 'archive' ||
      hash === 'admin'
    ) {
      return hash;
    }
    const saved = localStorage.getItem('ausbildung_active_tab') as WorkspaceTab | null;
    if (
      saved === 'tailor' ||
      saved === 'finder' ||
      saved === 'profile' ||
      saved === 'archive' ||
      saved === 'admin'
    ) {
      return saved;
    }
    return 'tailor';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadStoredTheme());
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(TUTORIAL_SEEN_KEY);
    } catch {
      return false;
    }
  });

  const [profile, setProfile] = useState<CandidateProfile>(() => loadStoredProfile());
  const [certificates, setCertificates] = useState<CandidateCertificatesMap>({
    high_school: null,
    german_cert: null,
  });
  const [applications, setApplications] = useState<SavedApplication[]>(() =>
    loadStoredApplications()
  );
  const [discoveredOpportunities, setDiscoveredOpportunities] = useState<
    AusbildungOpportunity[]
  >(() => loadStoredOpportunities());
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<MatchNotification[]>(() =>
    loadStoredNotifications()
  );
  const [templateConfig, setTemplateConfig] = useState<DocumentTemplateConfig>(() =>
    loadStoredTemplateConfig()
  );

  // Active tailoring session state
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus>('draft');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [targetCompany, setTargetCompany] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('');
  const [language, setLanguage] = useState<OutputLanguage>('de_with_notes');
  const [tone, setTone] = useState<ApplicationTone>('modern');
  const [activePackage, setActivePackage] = useState<TailoredPackage | null>(null);

  useEffect(() => {
    window.location.hash = activeTab;
    localStorage.setItem('ausbildung_active_tab', activeTab);
    if (firebaseUser && activeTab === 'admin' && !isSuperAdmin) {
      setActiveTab('tailor');
    }
  }, [activeTab, firebaseUser, isSuperAdmin]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(applications));
    } catch {
      // Ignore storage quota errors
    }
  }, [applications]);

  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templateConfig));
    } catch {
      // Ignore storage quota errors
    }
  }, [templateConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(
        DISCOVERED_STORAGE_KEY,
        JSON.stringify(discoveredOpportunities.slice(0, 60))
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [discoveredOpportunities]);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(notifications.slice(0, 40)));
    } catch {
      // Ignore storage quota errors
    }
  }, [notifications]);

  useEffect(() => {
    let active = true;
    void loadCertificates().then((loaded) => {
      if (active) setCertificates(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const refreshHighMatchNotifications = useCallback(
    (opportunitiesOverride?: AusbildungOpportunity[]): number => {
      const sourceOpps = opportunitiesOverride ?? discoveredOpportunities;
      const now = new Date().toISOString();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      let highCount = 0;

      setNotifications((prev) => {
        const prevMap = new Map(prev.map((n) => [n.opportunityId, n]));
        const nextList: MatchNotification[] = [];

        for (const opp of sourceOpps) {
          const res = evaluateOpportunityMatch(opp, profile, applications, certificates);
          if (!res.isHighMatch) continue;
          highCount += 1;

          const existing = prevMap.get(opp.id);
          const firstSeenMs = opp.firstSeenAt ? Date.parse(opp.firstSeenAt) : Date.now();
          const isNewListing = !Number.isNaN(firstSeenMs)
            ? Date.now() - firstSeenMs <= sevenDaysMs
            : true;

          // Surface again as unread if score or matched saved app upgraded meaningfully
          const upgraded =
            existing &&
            (res.score > existing.matchScore + 4 ||
              (res.matchedAppLabel && res.matchedAppLabel !== existing.matchedAppLabel));

          nextList.push({
            id: existing?.id || `notif-${opp.id}`,
            opportunityId: opp.id,
            title: opp.title,
            companyName: opp.companyName,
            location: opp.location,
            matchScore: res.score,
            matchedAppLabel: res.matchedAppLabel,
            isNewListing,
            read: existing && !upgraded ? existing.read : false,
            createdAt: existing?.createdAt || now,
          });
        }

        return nextList.sort((a, b) => b.matchScore - a.matchScore);
      });

      return highCount;
    },
    [discoveredOpportunities, profile, applications, certificates]
  );

  useEffect(() => {
    if (discoveredOpportunities.length > 0) {
      refreshHighMatchNotifications();
    }
  }, [applications, profile, certificates, discoveredOpportunities.length, refreshHighMatchNotifications]);

  const handleCloseTutorial = () => {
    setTutorialOpen(false);
    try {
      localStorage.setItem(TUTORIAL_SEEN_KEY, '1');
    } catch {
      // Ignore
    }
  };

  const handleUploadCertificate = async (type: CertificateType, file: File) => {
    const cert = await fileToCertificate(file, type);
    await saveCertificate(cert);
    setCertificates((prev) => ({ ...prev, [type]: cert }));
  };

  const handleDeleteCertificate = async (type: CertificateType) => {
    await deleteCertificate(type);
    setCertificates((prev) => ({ ...prev, [type]: null }));
  };

  const handleMergeDiscoveredOpportunities = (incoming: AusbildungOpportunity[]) => {
    const now = new Date().toISOString();
    setDiscoveredOpportunities((prev) => {
      const map = new Map<string, AusbildungOpportunity>();
      for (const old of prev) {
        map.set(old.id, old);
      }
      for (const item of incoming) {
        const existing = map.get(item.id);
        map.set(item.id, {
          ...existing,
          ...item,
          firstSeenAt: existing?.firstSeenAt || item.firstSeenAt || now,
        });
      }
      return Array.from(map.values()).slice(0, 60);
    });
  };

  const handleAutoSavePackage = (
    pkg: TailoredPackage,
    jobText: string,
    preferredStatus?: ApplicationStatus
  ): SavedApplication => {
    const now = new Date().toISOString();
    const statusToUse = preferredStatus || (activeStatus === 'draft' ? 'ready' : activeStatus);
    const newId = `app-${Date.now()}`;
    const newApp: SavedApplication = {
      id: newId,
      createdAt: now,
      updatedAt: now,
      status: statusToUse,
      language,
      tone,
      templateConfig,
      jobDescription: jobText,
      packageData: pkg,
    };
    setApplications((prev) => [newApp, ...prev]);
    setActiveAppId(newId);
    setActiveStatus(statusToUse);
    return newApp;
  };

  const handleSaveApplication = () => {
    if (!activePackage) return;
    const now = new Date().toISOString();

    if (activeAppId) {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === activeAppId
            ? {
                ...app,
                updatedAt: now,
                status: activeStatus,
                language,
                tone,
                templateConfig,
                jobDescription,
                packageData: activePackage,
              }
            : app
        )
      );
    } else {
      handleAutoSavePackage(activePackage, jobDescription);
    }
  };

  const handleStartNewApplication = () => {
    setActiveAppId(null);
    setActiveStatus('draft');
    setActivePackage(null);
    setTargetCompany('');
    setTargetRole('');
    setJobDescription('');
    setActiveTab('tailor');
  };

  const handleOpenSavedApplication = (app: SavedApplication) => {
    setActiveAppId(app.id);
    setActiveStatus(app.status);
    setLanguage(app.language);
    setTone(app.tone);
    if (app.templateConfig) {
      setTemplateConfig(app.templateConfig);
    }
    setJobDescription(app.jobDescription);
    setTargetCompany('');
    setTargetRole('');
    setActivePackage(app.packageData);
    setActiveTab('tailor');
  };

  const handleUpdateSavedStatus = (id: string, status: ApplicationStatus) => {
    const now = new Date().toISOString();
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status, updatedAt: now } : app))
    );
    if (activeAppId === id) {
      setActiveStatus(status);
    }
  };

  const handleDuplicateApplication = (app: SavedApplication) => {
    const now = new Date().toISOString();
    const copy: SavedApplication = {
      ...app,
      id: `app-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      status: 'draft',
    };
    setApplications((prev) => [copy, ...prev]);
  };

  const handleDeleteApplication = (id: string) => {
    setApplications((prev) => prev.filter((app) => app.id !== id));
    if (activeAppId === id) {
      setActiveAppId(null);
    }
  };

  const handleSyncCvToProfile = (cvToSync: TailoredCv) => {
    const mergedSkills = cvToSync.skills
      .flatMap((group) => group.items)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');

    setProfile((prev) => ({
      ...prev,
      summary: cvToSync.profileStatement || prev.summary,
      experience: cvToSync.experience.map((exp, idx) => ({
        id: prev.experience[idx]?.id || `exp-${Date.now()}-${idx}`,
        period: exp.period,
        role: exp.role,
        organization: exp.organization,
        location: exp.location,
        highlights: exp.bullets.join('; '),
      })),
      education: cvToSync.education.map((edu, idx) => ({
        id: prev.education[idx]?.id || `edu-${Date.now()}-${idx}`,
        period: edu.period,
        degree: edu.degree,
        institution: edu.institution,
        location: edu.location,
        details: edu.details,
      })),
      skills: mergedSkills || prev.skills,
      languages: cvToSync.languages.map((lang, idx) => ({
        id: prev.languages[idx]?.id || `lang-${Date.now()}-${idx}`,
        language: lang.language,
        level: lang.level,
      })),
      interests: cvToSync.interests,
    }));
  };

  const breadcrumbLabel =
    activeTab === 'tailor'
      ? 'تجهيز التقديم'
      : activeTab === 'finder'
      ? 'البحث والتقديم التلقائي'
      : activeTab === 'profile'
      ? 'ملفي الشخصي'
      : activeTab === 'admin'
      ? 'لوحة المشرف'
      : 'طلباتي المحفوظة';

  const unreadHighMatchCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      dir="rtl"
      className="min-h-screen max-w-7xl mx-auto flex bg-[#F3F6FA] dark:bg-[#0E1624] text-slate-900 dark:text-[#EEF2F8] transition-colors"
    >
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        profile={profile}
        savedCount={applications.length}
        highMatchCount={unreadHighMatchCount}
        onOpenTutorial={() => setTutorialOpen(true)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="h-16 bg-white dark:bg-[#162133] border-b border-slate-200 dark:border-[#2A3B56] px-4 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="فتح القائمة"
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 dark:text-slate-500">مساحة العمل</span>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 dark:text-[#EEF2F8] truncate">
                {breadcrumbLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <NotificationBell
              notifications={notifications}
              onMarkAllRead={() =>
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }
              onSelectNotification={(notif) => {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
                );
                setSelectedOpportunityId(notif.opportunityId);
                setActiveTab('finder');
              }}
            />

            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              aria-label="شرح التطبيق"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-[#F3F6FA] dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-200/70 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <HelpCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span className="hidden md:inline">شرح التطبيق</span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>لوحة المشرف</span>
              </button>
            )}

            {firebaseUser ? (
              <button
                type="button"
                onClick={() => void signOutUser()}
                aria-label="تسجيل الخروج"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-[#F3F6FA] dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-200/70 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">تسجيل الخروج</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-[#F3F6FA] dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-200/70 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>تسجيل الدخول</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'تفعيل الوضع الليلي' : 'تفعيل الوضع النهاري'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-[#F3F6FA] dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-200/70 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-slate-600" />
                  <span className="hidden md:inline">الوضع الليلي</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                  <span className="hidden md:inline">الوضع النهاري</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleStartNewApplication}
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              طلب جديد
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 max-w-290 w-full mx-auto my-6 px-4">
          {activeTab === 'tailor' && (
            <TailorWorkspace
              profile={profile}
              certificates={certificates}
              onUpdatePhoto={(photoUrl) =>
                setProfile((prev) => ({ ...prev, photoUrl }))
              }
              onUpdateProfile={setProfile}
              onSyncCvToProfile={handleSyncCvToProfile}
              templateConfig={templateConfig}
              onChangeTemplateConfig={setTemplateConfig}
              jobDescription={jobDescription}
              onChangeJobDescription={setJobDescription}
              targetCompany={targetCompany}
              onChangeTargetCompany={setTargetCompany}
              targetRole={targetRole}
              onChangeTargetRole={setTargetRole}
              language={language}
              onChangeLanguage={setLanguage}
              tone={tone}
              onChangeTone={setTone}
              activePackage={activePackage}
              onChangePackage={setActivePackage}
              activeAppId={activeAppId}
              activeStatus={activeStatus}
              onChangeStatus={(status) => {
                setActiveStatus(status);
                if (activeAppId) handleUpdateSavedStatus(activeAppId, status);
              }}
              onSaveApplication={handleSaveApplication}
              onAutoSavePackage={(pkg, jobText) => handleAutoSavePackage(pkg, jobText)}
              onGoToProfile={() => setActiveTab('profile')}
              onGoToArchive={() => setActiveTab('archive')}
            />
          )}

          {activeTab === 'finder' && (
            <AusbildungFinder
              profile={profile}
              certificates={certificates}
              templateConfig={templateConfig}
              language={language}
              tone={tone}
              savedApplications={applications}
              discoveredOpportunities={discoveredOpportunities}
              selectedOpportunityId={selectedOpportunityId}
              onSelectOpportunityId={setSelectedOpportunityId}
              onMergeDiscoveredOpportunities={handleMergeDiscoveredOpportunities}
              onAutoSaveApplication={handleAutoSavePackage}
              onUpdateSavedStatus={handleUpdateSavedStatus}
              onOpenInTailor={(pkg, jobText, savedAppId) => {
                setActivePackage(pkg);
                setJobDescription(jobText);
                setActiveAppId(savedAppId || null);
                setActiveStatus('ready');
                setActiveTab('tailor');
              }}
              onRefreshNotifications={refreshHighMatchNotifications}
              onGoToProfile={() => setActiveTab('profile')}
              onGoToArchive={() => setActiveTab('archive')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              profile={profile}
              certificates={certificates}
              activePackage={activePackage}
              onChange={setProfile}
              onUploadCertificate={handleUploadCertificate}
              onDeleteCertificate={handleDeleteCertificate}
              onSyncCvToProfile={handleSyncCvToProfile}
              onGoToTailor={() => setActiveTab('tailor')}
            />
          )}

          {activeTab === 'archive' && (
            <ApplicationsArchive
              applications={applications}
              onOpenApplication={handleOpenSavedApplication}
              onUpdateStatus={handleUpdateSavedStatus}
              onDuplicateApplication={handleDuplicateApplication}
              onDeleteApplication={handleDeleteApplication}
              onGoToTailor={handleStartNewApplication}
              onGoToFinder={() => setActiveTab('finder')}
            />
          )}

          {activeTab === 'admin' && isSuperAdmin && <AdminDashboard />}
        </main>
      </div>

      <AppTutorialModal
        isOpen={tutorialOpen}
        onClose={handleCloseTutorial}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}
