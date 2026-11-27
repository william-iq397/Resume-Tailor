import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Sparkles } from 'lucide-react';
import type { MatchNotification } from '../types/ausbildung';

interface NotificationBellProps {
  notifications: MatchNotification[];
  onMarkAllRead: () => void;
  onSelectNotification: (notif: MatchNotification) => void;
}

export function NotificationBell({
  notifications,
  onMarkAllRead,
  onSelectNotification,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative no-print">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="إشعارات التطابق"
        aria-expanded={open}
        className="relative inline-flex items-center justify-center p-2 text-slate-700 dark:text-[#EEF2F8] bg-[#F3F6FA] dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-200/70 dark:hover:bg-[#243652] rounded-lg transition-colors shrink-0"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold font-mono-tabular">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="تنبيهات الفرص المتطابقة"
          className="absolute left-0 mt-2 w-[340px] sm:w-[390px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#2A3B56] bg-slate-50 dark:bg-[#121C2C]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-[#EEF2F8]">
                إشعارات القبول العالي
              </span>
              <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-[#9FB0C7]">
                ({notifications.length})
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-200 dark:divide-[#2A3B56]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center space-y-1.5">
                <p className="text-xs font-medium text-slate-700 dark:text-[#C5D1E0]">
                  لا توجد تنبيهات جديدة حالياً
                </p>
                <p className="text-[11px] text-slate-500 dark:text-[#9FB0C7] leading-relaxed">
                  عند البحث في صفحة «البحث والتقديم التلقائي»، سيتم تنبيهك تلقائياً لأي فرصة
                  قديمة أو جديدة بنسبة قبول ٧٠٪ فأكثر بناءً على طلباتك المحفوظة.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => {
                    onSelectNotification(notif);
                    setOpen(false);
                  }}
                  className={`w-full text-right px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#1D2B42]/70 transition-colors block ${
                    !notif.read ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-[#EEF2F8] line-clamp-1">
                      {notif.title}
                    </p>
                    <span className="font-mono-tabular text-xs font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                      {notif.matchScore}%
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-[#9FB0C7] mt-1">
                    {notif.companyName}
                    {notif.location ? ` · ${notif.location}` : ''}
                    {' · '}
                    <span className="font-medium">
                      {notif.isNewListing ? 'إعلان جديد' : 'إعلان محفوظ سابقاً'}
                    </span>
                  </p>

                  <p className="text-[11px] text-teal-800 dark:text-teal-300 mt-1.5 leading-snug">
                    {notif.matchedAppLabel
                      ? `قريب من طلبك المحفوظ: ${notif.matchedAppLabel}`
                      : 'نسبة توافق عالية مع ملفك الشخصي ومستوى لغتك'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
