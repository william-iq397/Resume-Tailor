import { ACCENT_OPTIONS, TEMPLATE_OPTIONS } from '../data/presets';
import type { DocumentTemplateConfig, DocumentTemplateId, TemplateAccentId } from '../types/ausbildung';

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
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4 no-print">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-500">Template:</span>
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {TEMPLATE_OPTIONS.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              title={tpl.subtitle}
              onClick={() =>
                onChange({ ...config, templateId: tpl.id as DocumentTemplateId })
              }
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                config.templateId === tpl.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Accent:</span>
          <div className="inline-flex items-center gap-1.5">
            {ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-label={`Accent color ${opt.label}`}
                title={opt.label}
                onClick={() => onChange({ ...config, accent: opt.id as TemplateAccentId })}
                className={`h-5 w-5 rounded-md border transition-transform ${
                  config.accent === opt.id
                    ? 'ring-2 ring-offset-1 ring-slate-900 scale-105 border-white'
                    : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: opt.hex }}
              />
            ))}
          </div>
        </div>

        {showPhotoToggle && (
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.showPhoto}
              onChange={(e) => onChange({ ...config, showPhoto: e.target.checked })}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span>Include Photo</span>
          </label>
        )}
      </div>
    </div>
  );
}
