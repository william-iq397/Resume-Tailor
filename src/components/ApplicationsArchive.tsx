import { useState } from 'react';
import { ArrowUpLeft, Compass, Copy, Search, Sparkles, Trash2 } from 'lucide-react';
import type { ApplicationStatus, SavedApplication } from '../types/ausbildung';

interface ApplicationsArchiveProps {
  applications: SavedApplication[];
  onOpenApplication: (app: SavedApplication) => void;
  onUpdateStatus: (id: string, status: ApplicationStatus) => void;
  onDuplicateApplication: (app: SavedApplication) => void;
  onDeleteApplication: (id: string) => void;
  onGoToTailor: () => void;
  onGoToFinder?: () => void;
}

const STATUS_LABELS: Record<ApplicationStatus, { label: string; colorClass: string }> = {
  draft: { label: 'مسودة', colorClass: 'text-slate-600 dark:text-slate-300' },
  ready: { label: 'جاهز للإرسال', colorClass: 'text-teal-700 dark:text-teal-300' },
  applied: { label: 'تم التقديم', colorClass: 'text-amber-700 dark:text-amber-300' },
  interview: { label: 'مقابلة عمل', colorClass: 'text-emerald-700 dark:text-emerald-300' },
};

export function ApplicationsArchive({
  applications,
  onOpenApplication,
  onUpdateStatus,
  onDuplicateApplication,
  onDeleteApplication,
  onGoToTailor,
  onGoToFinder,
}: ApplicationsArchiveProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');

  const filtered = applications.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const q = query.trim().toLowerCase();
    if (!q) return matchesStatus;
    const role = item.packageData.jobAnalysis.roleTitle.toLowerCase();
    const company = item.packageData.jobAnalysis.companyName.toLowerCase();
    const city = item.packageData.jobAnalysis.location.toLowerCase();
    return matchesStatus && (role.includes(q) || company.includes(q) || city.includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-[#EEF2F8]">
            طلباتي المحفوظة
          </h1>
          <p className="text-sm text-slate-600 dark:text-[#9FB0C7] mt-1">
            جميع طلبات التدريب المهني التي جهزتها تُحفظ هنا تلقائياً حسب الشركة والمهنة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          {onGoToFinder && (
            <button
              type="button"
              onClick={onGoToFinder}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-[#EEF2F8] bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#1D2B42] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Compass className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              البحث ومطابقة الفرص
            </button>
          )}
          <button
            type="button"
            onClick={onGoToTailor}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            تجهيز طلب جديد
          </button>
        </div>
      </div>

      <div className="bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 rounded-lg px-4 py-3 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2.5">
        <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
        <span>
          <strong>كيف تعمل المطابقة الذكية؟</strong> يتم حفظ كل طلب تجهزه هنا تلقائياً، ويستخدم
          محرك البحث هذه الطلبات لحساب نسبة قبولك في الإعلانات الجديدة والسابقة وإرسال تنبيه لك
          عندما تتطابق فرصة بنسبة ٧٠٪ فأكثر.
        </span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الشركة أو المهنة أو المدينة..."
            className="w-full pr-9 pl-3 py-2 text-sm bg-slate-50 dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] rounded-lg text-slate-900 dark:text-[#EEF2F8] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1D2B42] rounded-lg overflow-x-auto">
          {(['all', 'draft', 'ready', 'applied', 'interview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab
                  ? 'bg-white dark:bg-[#2A3B56] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab === 'all' ? 'الكل' : STATUS_LABELS[tab].label}
            </button>
          ))}
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-12 text-center">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-[#EEF2F8]">
            لا توجد طلبات محفوظة بعد
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#9FB0C7] mt-1 max-w-md mx-auto">
            اذهب إلى صفحة تجهيز التقديم، الصق إعلان التدريب المهني، ثم اضغط حفظ لتظهر طلباتك هنا.
          </p>
          <button
            type="button"
            onClick={onGoToTailor}
            className="mt-5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap"
          >
            ابدأ أول طلب الآن
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg p-10 text-center">
          <p className="text-sm text-slate-600 dark:text-[#9FB0C7]">
            لا توجد نتائج مطابقة للبحث أو الحالة المختارة.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#2A3B56] bg-slate-50 dark:bg-[#1D2B42] text-xs font-medium text-slate-500 dark:text-[#9FB0C7]">
                  <th className="py-3 px-4">الشركة</th>
                  <th className="py-3 px-4">المهنة (Ausbildung)</th>
                  <th className="py-3 px-4">المدينة</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-left">آخر تحديث</th>
                  <th className="py-3 px-4 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#2A3B56] text-sm">
                {filtered.map((app) => {
                  const analysis = app.packageData.jobAnalysis;
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-[#1D2B42]/60 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-[#EEF2F8]">
                        <button
                          type="button"
                          onClick={() => onOpenApplication(app)}
                          className="text-right hover:text-teal-700 dark:hover:text-teal-300 hover:underline"
                        >
                          {analysis.companyName || 'الشركة المستهدفة'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-[#C5D1E0] max-w-xs truncate">
                        {analysis.roleTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-[#9FB0C7] whitespace-nowrap">
                        {analysis.location || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          aria-label={`الحالة لطلب ${analysis.companyName}`}
                          value={app.status}
                          onChange={(e) =>
                            onUpdateStatus(app.id, e.target.value as ApplicationStatus)
                          }
                          className={`bg-transparent text-xs font-medium focus:outline-none cursor-pointer ${
                            STATUS_LABELS[app.status].colorClass
                          }`}
                        >
                          <option value="draft">مسودة</option>
                          <option value="ready">جاهز للإرسال</option>
                          <option value="applied">تم التقديم</option>
                          <option value="interview">مقابلة عمل</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-left font-mono-tabular text-xs text-slate-500 dark:text-[#9FB0C7] whitespace-nowrap">
                        {new Date(app.updatedAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="py-3 px-4 text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenApplication(app)}
                            title="فتح المستندات"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 rounded-md hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-colors"
                          >
                            <ArrowUpLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateApplication(app)}
                            title="نسخ الطلب"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-[#1D2B42] transition-colors"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteApplication(app.id)}
                            title="حذف الطلب"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
