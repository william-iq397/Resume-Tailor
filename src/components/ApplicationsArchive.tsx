import { useState } from 'react';
import { ArrowUpRight, Copy, Search, Trash2 } from 'lucide-react';
import type { ApplicationStatus, SavedApplication } from '../types/ausbildung';

interface ApplicationsArchiveProps {
  applications: SavedApplication[];
  onOpenApplication: (app: SavedApplication) => void;
  onUpdateStatus: (id: string, status: ApplicationStatus) => void;
  onDuplicateApplication: (app: SavedApplication) => void;
  onDeleteApplication: (id: string) => void;
  onGoToTailor: () => void;
}

const STATUS_LABELS: Record<ApplicationStatus, { label: string; colorClass: string }> = {
  draft: { label: 'Draft', colorClass: 'text-slate-600' },
  ready: { label: 'Ready to Send', colorClass: 'text-blue-700' },
  applied: { label: 'Applied', colorClass: 'text-amber-700' },
  interview: { label: 'Interview', colorClass: 'text-emerald-700' },
};

export function ApplicationsArchive({
  applications,
  onOpenApplication,
  onUpdateStatus,
  onDuplicateApplication,
  onDeleteApplication,
  onGoToTailor,
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
          <h1 className="font-display text-2xl font-bold text-slate-900">Saved Applications</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track each tailored Lebenslauf and Anschreiben by company, role, and status.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToTailor}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          New Application
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-lg p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by company, Ausbildungsberuf, or city..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(['all', 'draft', 'ready', 'applied', 'interview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'All' : STATUS_LABELS[tab].label}
            </button>
          ))}
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            No saved Ausbildung applications yet
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Paste a German job posting in the Tailor workspace to generate a custom Lebenslauf and
            Anschreiben, then save it here to track your progress.
          </p>
          <button
            type="button"
            onClick={onGoToTailor}
            className="mt-5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Tailor First Application
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center">
          <p className="text-sm text-slate-600">No applications match your current search or status filter.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Ausbildungsberuf</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((app) => {
                  const analysis = app.packageData.jobAnalysis;
                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <button
                          type="button"
                          onClick={() => onOpenApplication(app)}
                          className="text-left hover:text-blue-700 hover:underline"
                        >
                          {analysis.companyName || 'Target Company'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                        {analysis.roleTitle}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {analysis.location || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          aria-label={`Status for ${analysis.companyName}`}
                          value={app.status}
                          onChange={(e) =>
                            onUpdateStatus(app.id, e.target.value as ApplicationStatus)
                          }
                          className={`bg-transparent text-xs font-medium focus:outline-none cursor-pointer ${
                            STATUS_LABELS[app.status].colorClass
                          }`}
                        >
                          <option value="draft">Draft</option>
                          <option value="ready">Ready to Send</option>
                          <option value="applied">Applied</option>
                          <option value="interview">Interview</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs text-slate-500 whitespace-nowrap">
                        {new Date(app.updatedAt).toLocaleDateString('de-DE')}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenApplication(app)}
                            title="Open documents"
                            className="p-1.5 text-slate-500 hover:text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
                          >
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateApplication(app)}
                            title="Duplicate application"
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteApplication(app.id)}
                            title="Delete application"
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
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
