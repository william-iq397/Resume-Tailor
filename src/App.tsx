import { useEffect, useState } from 'react';
import { LogIn, Menu, Moon, ShieldCheck, Sun } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { ApplicationsArchive } from './components/ApplicationsArchive';
import { ProfileView } from './components/ProfileView';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TailorWorkspace } from './components/TailorWorkspace';
import { useAuth } from './contexts/AuthContext';
import {
  DEFAULT_TEMPLATE_CONFIG,
  SAMPLE_JOB_PRESETS,
  SAMPLE_PROFILE,
} from './data/presets';
import type {
  ApplicationStatus,
  ApplicationTone,
  CandidateProfile,
  DocumentTemplateConfig,
  OutputLanguage,
  SavedApplication,
  TailoredCv,
  TailoredPackage,
} from './types/ausbildung';

const PROFILE_STORAGE_KEY = 'ausbildung_studio_profile_v1';
const APPS_STORAGE_KEY = 'ausbildung_studio_apps_v1';
const TEMPLATE_STORAGE_KEY = 'ausbildung_studio_template_v1';
const THEME_STORAGE_KEY = 'ausbildung_studio_theme_v1';

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

export default function App() {
  const { firebaseUser, isSuperAdmin, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tailor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadStoredTheme());

  const [profile, setProfile] = useState<CandidateProfile>(() => loadStoredProfile());
  const [applications, setApplications] = useState<SavedApplication[]>(() =>
    loadStoredApplications()
  );
  const [templateConfig, setTemplateConfig] = useState<DocumentTemplateConfig>(() =>
    loadStoredTemplateConfig()
  );

  // Active tailoring session state
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus>('draft');
  const [jobDescription, setJobDescription] = useState<string>(
    SAMPLE_JOB_PRESETS[0].description
  );
  const [targetCompany, setTargetCompany] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('');
  const [language, setLanguage] = useState<OutputLanguage>('de_with_notes');
  const [tone, setTone] = useState<ApplicationTone>('modern');
  const [activePackage, setActivePackage] = useState<TailoredPackage | null>(null);

  useEffect(() => {
    if (activeTab === 'admin' && !isSuperAdmin) {
      setActiveTab('tailor');
    }
  }, [activeTab, isSuperAdmin]);

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
      const newId = `app-${Date.now()}`;
      const newApp: SavedApplication = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        status: activeStatus,
        language,
        tone,
        templateConfig,
        jobDescription,
        packageData: activePackage,
      };
      setApplications((prev) => [newApp, ...prev]);
      setActiveAppId(newId);
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
      : activeTab === 'profile'
      ? 'ملفي الشخصي'
      : activeTab === 'admin'
      ? 'لوحة المشرف'
      : 'طلباتي المحفوظة';

  return (
    <div
      dir="rtl"
      className="min-h-screen flex bg-[#F3F6FA] dark:bg-[#0E1624] text-slate-900 dark:text-[#EEF2F8] transition-colors"
    >
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        profile={profile}
        savedCount={applications.length}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="h-16 bg-white dark:bg-[#162133] border-b border-slate-200 dark:border-[#2A3B56] px-4 lg:px-8 flex items-center justify-between gap-8 no-print">
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

          <div className="flex items-center gap-3 shrink-0">
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

            {!firebaseUser && (
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
                  <span>الوضع الليلي</span>
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-300" />
                  <span>الوضع النهاري</span>
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
        <main className="flex-1 p-4 md:p-8 max-w-[1160px] w-full mx-auto">
          {activeTab === 'tailor' && (
            <TailorWorkspace
              profile={profile}
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
              onGoToProfile={() => setActiveTab('profile')}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              profile={profile}
              activePackage={activePackage}
              onChange={setProfile}
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
            />
          )}

          {activeTab === 'admin' && isSuperAdmin && <AdminDashboard />}
        </main>
      </div>
    </div>
  );
}
