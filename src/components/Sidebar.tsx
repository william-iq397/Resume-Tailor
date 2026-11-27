import {
  FileText,
  FolderKanban,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { FREE_QUOTA_LIMIT, useAuth } from '../contexts/AuthContext';
import type { CandidateProfile } from '../types/ausbildung';

export type WorkspaceTab = 'tailor' | 'profile' | 'archive' | 'admin';

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
  const {
    firebaseUser,
    userDoc,
    isSuperAdmin,
    hasPaidAccess,
    freeRemaining,
    signInWithGoogle,
    signOutUser,
  } = useAuth();

  const navItems: { id: WorkspaceTab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: 'tailor', label: 'تجهيز التقديم', icon: FileText },
    { id: 'profile', label: 'ملفي الشخصي', icon: UserCheck },
    { id: 'archive', label: 'طلباتي المحفوظة', icon: FolderKanban, count: savedCount },
    ...(isSuperAdmin
      ? [{ id: 'admin' as WorkspaceTab, label: 'لوحة المشرف', icon: ShieldCheck }]
      : []),
  ];

  const primaryLanguage = profile.languages[0];

  const sidebarBody = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-[#162133] border-l border-slate-200 dark:border-[#2A3B56] w-65">
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

      <div className="border-t border-slate-200 dark:border-[#2A3B56] p-4 bg-[#F8FAFC] dark:bg-[#121C2C] space-y-3">
        <div className="pt-3 border-t border-slate-200 dark:border-[#2A3B56]">
          {firebaseUser ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-500 dark:text-[#9FB0C7]">
                {isSuperAdmin
                  ? 'حساب المشرف العام'
                  : hasPaidAccess && userDoc?.paidUntil
                  ? `الاشتراك فعّال حتى ${userDoc.paidUntil.toDate().toLocaleDateString('ar-EG')}`
                  : freeRemaining > 0
                  ? `مجاني: متبقي ${freeRemaining} من ${FREE_QUOTA_LIMIT}`
                  : 'انتهى الرصيد — أدخل كود تفعيل'}
              </p>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-[#9FB0C7] hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              تسجيل الدخول بحساب Google
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto shrink-0 no-print">
        {sidebarBody}
      </aside>
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
