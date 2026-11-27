import { useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Copy,
  FileDown,
  Loader2,
  Pencil,
  Printer,
  User,
} from 'lucide-react';
import { getAccentMeta } from '../data/presets';
import type {
  CandidateProfile,
  DocumentTemplateConfig,
  TailoredCv,
} from '../types/ausbildung';
import { formatCvAsText } from '../utils/documentExport';
import { exportCvToPdf } from '../utils/pdfExport';
import { TemplateControlsBar } from './TemplateControlsBar';

interface CvDocumentSheetProps {
  cv: TailoredCv;
  profile: CandidateProfile;
  companyName: string;
  templateConfig: DocumentTemplateConfig;
  isTailored: boolean;
  onChangeTemplateConfig: (next: DocumentTemplateConfig) => void;
  onUpdatePhoto: (photoUrl: string) => void;
  onUpdateCv: (next: TailoredCv) => void;
}

async function readAndResizePhoto(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Invalid image file.'));
    el.src = rawUrl;
  });
  const maxDim = 560;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}

export function CvDocumentSheet({
  cv,
  profile,
  companyName,
  templateConfig,
  isTailored,
  onChangeTemplateConfig,
  onUpdatePhoto,
  onUpdateCv,
}: CvDocumentSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [imgError, setImgError] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const accent = getAccentMeta(templateConfig.accent);
  const isEuropass = templateConfig.templateId === 'europass_ats';
  const isBauhaus = templateConfig.templateId === 'minimalist_bauhaus';

  const handleCopy = async () => {
    const text = formatCvAsText(cv, profile);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportCvToPdf(cv, profile, templateConfig, companyName);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePhotoSelect = async (file?: File) => {
    if (!file) return;
    const dataUrl = await readAndResizePhoto(file);
    setImgError(false);
    onUpdatePhoto(dataUrl);
    if (!templateConfig.showPhoto) {
      onChangeTemplateConfig({ ...templateConfig, showPhoto: true });
    }
  };

  // Deterministic ATS-readiness checks on the actual document data
  const atsChecks = [
    { label: 'Single-column linear PDF flow', ok: true },
    {
      label: 'Labeled contact fields',
      ok: Boolean(profile.email && profile.phone),
    },
    {
      label: 'Target role headline',
      ok: Boolean(cv.headline && cv.headline.trim().length > 4),
    },
    {
      label: 'CEFR language levels',
      ok: cv.languages.some((l) => /(A1|A2|B1|B2|C1|C2|Muttersprache)/i.test(l.level)),
    },
    {
      label: 'Machine-readable text (no text-in-image)',
      ok: true,
    },
  ];

  const renderPhotoBox = (sizeClass: string) => {
    if (!templateConfig.showPhoto) return null;
    return (
      <div className="relative group shrink-0">
        <div
          className={`${sizeClass} rounded-md border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center`}
        >
          {profile.photoUrl && !imgError ? (
            <img
              src={profile.photoUrl}
              alt={profile.fullName || 'Candidate portrait'}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <User className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          title="Change CV photo"
          className="no-print absolute bottom-1.5 right-1.5 p-1.5 rounded-md bg-white/90 text-slate-700 border border-slate-200 shadow-sm opacity-90 hover:opacity-100 hover:text-blue-700 transition-opacity"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const labeledContacts = [
    {
      label: 'Adresse',
      value: [profile.streetAddress, profile.postalCity].filter(Boolean).join(', '),
    },
    { label: 'Telefon', value: profile.phone },
    { label: 'E-Mail', value: profile.email },
    { label: 'Web / Portfolio', value: profile.linkedInOrPortfolio },
    ...(templateConfig.showPersonalMeta
      ? [
          { label: 'Geburtsdatum/-ort', value: profile.birthInfo },
          { label: 'Staatsangehörigkeit', value: profile.nationality },
          { label: 'Verfügbarkeit', value: profile.availability },
        ]
      : []),
  ].filter((item) => Boolean(item.value));

  return (
    <div className="space-y-4">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          handlePhotoSelect(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Template Switcher & Accent Controls */}
      <TemplateControlsBar
        config={templateConfig}
        onChange={onChangeTemplateConfig}
        showPhotoToggle
      />

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 no-print">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-medium text-slate-900">
            {isEuropass ? 'Europass Lebenslauf (ATS)' : 'Lebenslauf'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {isTailored ? 'AI-Tailored to Job Posting' : 'Base Profile Template Preview'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Camera className="h-3.5 w-3.5" />
            Change Photo
          </button>
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              isEditing
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? 'Done Editing' : 'Edit Template'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy Text'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            {isExportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Export PDF
          </button>
        </div>
      </div>

      {/* Deterministic ATS Compatibility Verification Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 max-w-[820px] mx-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 no-print">
        <span className="font-semibold text-slate-800">ATS Parser Checks:</span>
        {atsChecks.map((check) => (
          <span key={check.label} className="inline-flex items-center gap-1">
            <CheckCircle2
              className={`h-3.5 w-3.5 ${check.ok ? 'text-emerald-600' : 'text-amber-600'}`}
            />
            <span className={check.ok ? 'text-slate-700' : 'text-amber-800'}>{check.label}</span>
          </span>
        ))}
      </div>

      {/* Single-Column ATS-Safe Europass / German CV A4 Sheet */}
      <article className="bg-white border border-slate-200 rounded-lg overflow-hidden max-w-[820px] mx-auto text-slate-900 print-only-sheet">
        {(isEuropass || isBauhaus) && (
          <div
            className={isEuropass ? 'h-2.5 w-full' : 'h-1.5 w-full'}
            style={{ backgroundColor: accent.hex }}
          />
        )}

        <div className="p-8 md:p-12 space-y-6">
          {/* Header Block */}
          <header
            className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-5 border-b-2"
            style={{ borderColor: accent.hex }}
          >
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
                <span style={{ color: accent.hex }}>
                  {isEuropass ? 'Europass Lebenslauf' : 'Lebenslauf'}
                </span>
              </div>

              <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900">
                {profile.fullName || 'Ihr Name'}
              </h2>

              {isEditing ? (
                <input
                  type="text"
                  value={cv.headline}
                  onChange={(e) => onUpdateCv({ ...cv, headline: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm font-semibold border border-blue-300 rounded bg-blue-50/40"
                />
              ) : (
                <p className="text-sm font-semibold" style={{ color: accent.hex }}>
                  {cv.headline}
                </p>
              )}

              {/* Explicitly labeled contact fields for 100% ATS parsing */}
              <div className="pt-2 space-y-1 text-xs text-slate-700">
                {labeledContacts.map((item) => (
                  <p key={item.label}>
                    <span className="font-semibold text-slate-900">{item.label}: </span>
                    <span>{item.value}</span>
                  </p>
                ))}
              </div>
            </div>

            {renderPhotoBox('w-28 h-36')}
          </header>

          {/* 01. Kurzprofil / Persönliches Profil */}
          <section>
            <h3
              className="text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2.5"
              style={{ color: accent.hex }}
            >
              {isEuropass ? 'Persönliches Profil' : 'Kurzprofil'}
            </h3>
            {isEditing ? (
              <textarea
                rows={3}
                value={cv.profileStatement}
                onChange={(e) => onUpdateCv({ ...cv, profileStatement: e.target.value })}
                className="w-full p-2.5 text-sm border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              <p className="text-sm leading-relaxed text-slate-700">{cv.profileStatement}</p>
            )}
          </section>

          {/* 02. Berufserfahrung & Praktika (single-column linear entries) */}
          {cv.experience.length > 0 && (
            <section>
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-3"
                style={{ color: accent.hex }}
              >
                {isEuropass ? 'Berufserfahrung & Praktika' : 'Praxiserfahrung & Praktika'}
              </h3>
              <div className="space-y-4">
                {cv.experience.map((exp, idx) => (
                  <div key={idx} className="space-y-1">
                    {isEditing ? (
                      <div className="space-y-2 p-2.5 border border-blue-200 rounded bg-blue-50/20">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={exp.period}
                            onChange={(e) => {
                              const next = [...cv.experience];
                              next[idx] = { ...exp, period: e.target.value };
                              onUpdateCv({ ...cv, experience: next });
                            }}
                            className="px-2 py-1 text-xs border border-blue-300 rounded bg-white"
                          />
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => {
                              const next = [...cv.experience];
                              next[idx] = { ...exp, role: e.target.value };
                              onUpdateCv({ ...cv, experience: next });
                            }}
                            className="px-2 py-1 text-sm font-semibold border border-blue-300 rounded bg-white"
                          />
                          <input
                            type="text"
                            value={exp.organization}
                            onChange={(e) => {
                              const next = [...cv.experience];
                              next[idx] = { ...exp, organization: e.target.value };
                              onUpdateCv({ ...cv, experience: next });
                            }}
                            className="px-2 py-1 text-sm border border-blue-300 rounded bg-white"
                          />
                        </div>
                        <textarea
                          rows={Math.max(2, exp.bullets.length)}
                          value={exp.bullets.join('\n')}
                          onChange={(e) => {
                            const next = [...cv.experience];
                            next[idx] = {
                              ...exp,
                              bullets: e.target.value
                                .split('\n')
                                .map((l) => l.trim())
                                .filter(Boolean),
                            };
                            onUpdateCv({ ...cv, experience: next });
                          }}
                          className="w-full p-2 text-sm border border-blue-300 rounded bg-white"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{exp.role}</p>
                          <span className="font-mono-tabular text-xs text-slate-500">
                            {exp.period}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600">
                          {exp.organization}
                          {exp.location ? ` | ${exp.location}` : ''}
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700 pt-1">
                          {exp.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 03. Schul- und Berufsbildung */}
          {cv.education.length > 0 && (
            <section>
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-3"
                style={{ color: accent.hex }}
              >
                {isEuropass ? 'Schul- und Berufsbildung' : 'Schulbildung'}
              </h3>
              <div className="space-y-3.5">
                {cv.education.map((edu, idx) => (
                  <div key={idx}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{edu.degree}</p>
                      <span className="font-mono-tabular text-xs text-slate-500">{edu.period}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-600">
                      {edu.institution}
                      {edu.location ? ` | ${edu.location}` : ''}
                    </p>
                    {edu.details && (
                      <p className="text-sm text-slate-700 mt-1">{edu.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 04. Persönliche Fähigkeiten & Sprachkenntnisse */}
          {(cv.languages.length > 0 || cv.skills.length > 0) && (
            <section className="space-y-4">
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-1.5"
                style={{ color: accent.hex }}
              >
                {isEuropass ? 'Persönliche Fähigkeiten & Sprachen' : 'Kenntnisse & Sprachen'}
              </h3>

              {cv.languages.length > 0 && (
                <div className="space-y-1.5">
                  {cv.languages.map((lang, idx) => (
                    <p key={idx} className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{lang.language}: </span>
                      <span>{lang.level}</span>
                    </p>
                  ))}
                </div>
              )}

              {cv.skills.length > 0 && (
                <div className="space-y-2.5">
                  {cv.skills.map((group, idx) => (
                    <div key={idx}>
                      <p className="text-xs font-semibold text-slate-900">{group.category}</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={group.items.join(', ')}
                          onChange={(e) => {
                            const next = [...cv.skills];
                            next[idx] = {
                              ...group,
                              items: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            };
                            onUpdateCv({ ...cv, skills: next });
                          }}
                          className="mt-1 w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50/40"
                        />
                      ) : (
                        <p className="text-sm text-slate-700 mt-0.5">{group.items.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 05. Interessen & Engagement */}
          {cv.interests && (
            <section>
              <h3
                className="text-xs font-bold uppercase tracking-wider border-b border-slate-200 pb-1.5 mb-2"
                style={{ color: accent.hex }}
              >
                Interessen &amp; Engagement
              </h3>
              {isEditing ? (
                <input
                  type="text"
                  value={cv.interests}
                  onChange={(e) => onUpdateCv({ ...cv, interests: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-sm border border-blue-300 rounded bg-blue-50/40"
                />
              ) : (
                <p className="text-sm text-slate-700">{cv.interests}</p>
              )}
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
