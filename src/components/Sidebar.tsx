import { FileText, FolderKanban, UserCheck, X } from 'lucide-react';
import type { CandidateProfile } from '../types/ausbildung';

export type WorkspaceTab = 'tailor' | 'profile' | 'archive';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  profile: CandidateProfile;
  savedCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  profile,
  savedCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navItems: { id: WorkspaceTab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: 'tailor', label: 'Tailor Application', icon: FileText },
    { id: 'profile', label: 'Base Profile', icon: UserCheck },
    { id: 'archive', label: 'Saved Applications', icon: FolderKanban, count: savedCount },
  ];

  const primaryLanguage = profile.languages[0];

  const sidebarBody = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 w-[256px]">
      <div>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('tailor');
              onCloseMobile();
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Ausbildung Studio
          </a>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="font-mono-tabular text-xs text-slate-500">{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-400 mb-1">Active Candidate</p>
        <p className="text-sm font-semibold text-slate-900 truncate">
          {profile.fullName || 'No name set'}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 truncate">
          {[
            profile.postalCity || 'Germany',
            primaryLanguage ? `${primaryLanguage.language} ${primaryLanguage.level}` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <button
          type="button"
          onClick={() => {
            onSelectTab('profile');
            onCloseMobile();
          }}
          className="mt-3 text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline whitespace-nowrap"
        >
          Edit Base Profile
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0 no-print">{sidebarBody}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{sidebarBody}</div>
        </div>
      )}
    </>
  );
}
