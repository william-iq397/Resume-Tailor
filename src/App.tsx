import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { ApplicationsArchive } from './components/ApplicationsArchive';
import { ProfileView } from './components/ProfileView';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TailorWorkspace } from './components/TailorWorkspace';
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
  TailoredPackage,
} from './types/ausbildung';

const PROFILE_STORAGE_KEY = 'ausbildung_studio_profile_v1';
const APPS_STORAGE_KEY = 'ausbildung_studio_apps_v1';
const TEMPLATE_STORAGE_KEY = 'ausbildung_studio_template_v1';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tailor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [targetCompany, setTargetCompany] = useState<string>(SAMPLE_JOB_PRESETS[0].company);
  const [targetRole, setTargetRole] = useState<string>(SAMPLE_JOB_PRESETS[0].role);
  const [language, setLanguage] = useState<OutputLanguage>('de_with_notes');
  const [tone, setTone] = useState<ApplicationTone>('modern');
  const [activePackage, setActivePackage] = useState<TailoredPackage | null>(null);

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
    setTargetCompany(app.packageData.jobAnalysis.companyName);
    setTargetRole(app.packageData.jobAnalysis.roleTitle);
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

  const breadcrumbLabel =
    activeTab === 'tailor'
      ? 'Tailor Application'
      : activeTab === 'profile'
      ? 'Base Profile'
      : 'Saved Applications';

  return (
    <div className="min-h-screen flex bg-[#F8F9FA] text-slate-900">
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
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400">Workspace</span>
              <span className="text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900 truncate">{breadcrumbLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleStartNewApplication}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              New Application
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 md:p-8 max-w-[1200px] w-full mx-auto">
          {activeTab === 'tailor' && (
            <TailorWorkspace
              profile={profile}
              onUpdatePhoto={(photoUrl) =>
                setProfile((prev) => ({ ...prev, photoUrl }))
              }
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
              onChange={setProfile}
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
        </main>
      </div>
    </div>
  );
}
