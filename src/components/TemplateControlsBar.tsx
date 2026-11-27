import { ACCENT_OPTIONS, TEMPLATE_OPTIONS } from '../data/presets';
import type {
  DocumentTemplateConfig,
  DocumentTemplateId,
  TemplateAccentId,
} from '../types/ausbildung';

interface TemplateControlsBarProps {
  config: DocumentTemplateConfig;
  onChange: (next: DocumentTemplateConfig) => void;
  showPhotoToggle?: boolean;
}

export function TemplateControlsBar({
  config,
  onChange,
  showPhotoToggle = true,
}: TemplateControlsBarProps) {
  return (
    <div className="bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4 no-print">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-600 dark:text-[#9FB0C7]">
          شكل القالب:
        </span>
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1D2B42] rounded-lg">
          {TEMPLATE_OPTIONS.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              title={tpl.subtitle}
              onClick={() =>
                onChange({ ...config, templateId: tpl.id as DocumentTemplateId })
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                config.templateId === tpl.id
                  ? 'bg-white dark:bg-[#2A3B56] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-[#9FB0C7] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600 dark:text-[#9FB0C7]">
            لون القالب:
          </span>
          <div className="inline-flex items-center gap-1.5">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-label={opt.label}
                title={opt.label}
                onClick={() => onChange({ ...config, accent: opt.id as TemplateAccentId })}
                className={`h-5 w-5 rounded-md border transition-transform ${
                  config.accent === opt.id
                    ? 'ring-2 ring-offset-1 ring-slate-900 dark:ring-white dark:ring-offset-[#162133] scale-105 border-white'
                    : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                }`}
                style={{ backgroundColor: opt.hex }}
              />
            ))}
          </div>
        </div>

        {showPhotoToggle && (
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.showPhoto}
              onChange={(e) => onChange({ ...config, showPhoto: e.target.checked })}
              className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <span>إظهار الصورة الشخصية</span>
          </label>
        )}
      </div>
    </div>
  );
}
