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
    { id: 'tailor', label: 'تجهيز التقديم', icon: FileText },
    { id: 'profile', label: 'ملفي الشخصي', icon: UserCheck },
    { id: 'archive', label: 'طلباتي المحفوظة', icon: FolderKanban, count: savedCount },
  ];

  const primaryLanguage = profile.languages[0];

  const sidebarBody = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-[#162133] border-l border-slate-200 dark:border-[#2A3B56] w-[260px]">
      <div>
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-[#2A3B56]">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('tailor');
              onCloseMobile();
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-[#EEF2F8] whitespace-nowrap shrink-0"
          >
            مساعد أوسبيلدونغ
          </a>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="إغلاق القائمة"
            className="lg:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1.5" aria-label="القائمة الرئيسية">
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
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'text-slate-600 dark:text-[#9FB0C7] hover:bg-slate-100/70 dark:hover:bg-[#1D2B42] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive
                        ? 'text-teal-700 dark:text-teal-300'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 dark:border-[#2A3B56] p-4 bg-[#F8FAFC] dark:bg-[#121C2C]">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          المتقدم الحالي
        </p>
        <p className="text-sm font-semibold text-slate-900 dark:text-[#EEF2F8] truncate">
          {profile.fullName || 'لم يتم إدخال الاسم'}
        </p>
        <p className="text-xs text-slate-500 dark:text-[#9FB0C7] mt-0.5 truncate">
          {[
            profile.postalCity || 'ألمانيا',
            primaryLanguage ? `${primaryLanguage.language} · ${primaryLanguage.level}` : '',
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
          className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
        >
          تعديل بياناتي
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
            className="fixed inset-0 bg-slate-950/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{sidebarBody}</div>
        </div>
      )}
    </>
  );
}
