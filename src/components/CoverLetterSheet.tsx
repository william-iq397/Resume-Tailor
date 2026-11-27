import { useState } from 'react';
import { Check, Copy, FileDown, Languages, Loader2, Pencil, Printer } from 'lucide-react';
import { getAccentMeta } from '../data/presets';
import type { DocumentTemplateConfig, TailoredCoverLetter } from '../types/ausbildung';
import { countCoverLetterWords, formatCoverLetterAsText } from '../utils/documentExport';
import { exportCoverLetterToPdf } from '../utils/pdfExport';
import { TemplateControlsBar } from './TemplateControlsBar';

interface CoverLetterSheetProps {
  letter: TailoredCoverLetter;
  companyName: string;
  templateConfig: DocumentTemplateConfig;
  isTailored: boolean;
  onChangeTemplateConfig: (next: DocumentTemplateConfig) => void;
  onUpdateLetter: (next: TailoredCoverLetter) => void;
}

export function CoverLetterSheet({
  letter,
  companyName,
  templateConfig,
  isTailored,
  onChangeTemplateConfig,
  onUpdateLetter,
}: CoverLetterSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showEnglishNotes, setShowEnglishNotes] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const accent = getAccentMeta(templateConfig.accent);
  const isEuropass = templateConfig.templateId === 'europass_ats';
  const isBauhaus = templateConfig.templateId === 'minimalist_bauhaus';
  const wordCount = countCoverLetterWords(letter);
  const pageFitText =
    wordCount <= 340
      ? 'Fits 1 DIN A4 page'
      : 'Slightly long — consider trimming for 1-page DIN 5008';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatCoverLetterAsText(letter));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportCoverLetterToPdf(letter, templateConfig, companyName);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <TemplateControlsBar
        config={templateConfig}
        onChange={onChangeTemplateConfig}
        showPhotoToggle={false}
      />

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 no-print">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="font-medium text-slate-900">
            {isEuropass ? 'Europass Anschreiben (DIN 5008 / ATS)' : 'Anschreiben (DIN 5008)'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {isTailored ? 'AI-Tailored to Job Posting' : 'Base Profile Template Preview'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{wordCount} words</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              wordCount <= 340 ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
            }
          >
            {pageFitText}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {letter.englishSummary && (
            <button
              type="button"
              onClick={() => setShowEnglishNotes((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                showEnglishNotes
                  ? 'bg-slate-100 text-slate-900 border-slate-300'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              English Summary
            </button>
          )}
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

      {showEnglishNotes && letter.englishSummary && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 max-w-[820px] mx-auto no-print">
          <p className="text-xs font-semibold text-slate-700 mb-1">
            English Translation &amp; Meaning Summary
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">{letter.englishSummary}</p>
        </div>
      )}

      {/* Single-column ATS-safe Europass / DIN 5008 Anschreiben */}
      <article className="bg-white border border-slate-200 rounded-lg overflow-hidden max-w-[820px] mx-auto text-slate-900 print-only-sheet">
        {(isEuropass || isBauhaus) && (
          <div
            className={isEuropass ? 'h-2.5 w-full' : 'h-1.5 w-full'}
            style={{ backgroundColor: accent.hex }}
          />
        )}

        <div className="p-8 md:p-14">
          {isEuropass && (
            <p
              className="text-xs font-bold tracking-wider uppercase mb-5"
              style={{ color: accent.hex }}
            >
              Europass Motivationsschreiben
            </p>
          )}

          {/* Linear Sender Block */}
          <div className="whitespace-pre-line text-xs text-slate-600 leading-relaxed mb-6 pb-4 border-b border-slate-200">
            {isEditing ? (
              <textarea
                rows={4}
                value={letter.senderBlock}
                onChange={(e) => onUpdateLetter({ ...letter, senderBlock: e.target.value })}
                className="w-full sm:w-80 p-2 text-xs border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              letter.senderBlock
            )}
          </div>

          {/* Recipient Block */}
          <div className="whitespace-pre-line text-sm text-slate-700 leading-relaxed mb-6">
            {isEditing ? (
              <textarea
                rows={4}
                value={letter.recipientBlock}
                onChange={(e) => onUpdateLetter({ ...letter, recipientBlock: e.target.value })}
                className="w-full sm:w-80 p-2 text-sm border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              letter.recipientBlock
            )}
          </div>

          {/* Place & Date */}
          <div className="text-right text-sm text-slate-700 mb-8 font-mono-tabular">
            {isEditing ? (
              <input
                type="text"
                value={letter.datePlaceLine}
                onChange={(e) => onUpdateLetter({ ...letter, datePlaceLine: e.target.value })}
                className="px-2 py-1 text-sm text-right border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              letter.datePlaceLine
            )}
          </div>

          {/* Betreff */}
          <div className="mb-6">
            {isEditing ? (
              <input
                type="text"
                value={letter.subjectLine}
                onChange={(e) => onUpdateLetter({ ...letter, subjectLine: e.target.value })}
                className="w-full px-2.5 py-1.5 text-base font-bold border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              <h2 className="text-base font-bold" style={{ color: accent.hex }}>
                {letter.subjectLine}
              </h2>
            )}
          </div>

          {/* Salutation */}
          <div className="mb-4 text-sm text-slate-900">
            {isEditing ? (
              <input
                type="text"
                value={letter.salutation}
                onChange={(e) => onUpdateLetter({ ...letter, salutation: e.target.value })}
                className="w-full px-2.5 py-1 text-sm border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              <p>{letter.salutation}</p>
            )}
          </div>

          {/* Body Paragraphs */}
          <div className="space-y-4 text-sm leading-7 text-slate-800">
            {isEditing ? (
              <textarea
                rows={14}
                value={letter.paragraphs.join('\n\n')}
                onChange={(e) =>
                  onUpdateLetter({
                    ...letter,
                    paragraphs: e.target.value
                      .split(/\n{2,}/)
                      .map((p) => p.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full p-3 text-sm leading-6 border border-blue-300 rounded bg-blue-50/40"
              />
            ) : (
              letter.paragraphs.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)
            )}
          </div>

          {/* Closing & Signature */}
          <div className="mt-8 space-y-6 text-sm text-slate-900">
            {isEditing ? (
              <div className="space-y-2 max-w-xs">
                <input
                  type="text"
                  value={letter.closing}
                  onChange={(e) => onUpdateLetter({ ...letter, closing: e.target.value })}
                  className="w-full px-2.5 py-1 text-sm border border-blue-300 rounded bg-blue-50/40"
                />
                <input
                  type="text"
                  value={letter.signatureName}
                  onChange={(e) => onUpdateLetter({ ...letter, signatureName: e.target.value })}
                  className="w-full px-2.5 py-1 text-sm border border-blue-300 rounded bg-blue-50/40"
                />
              </div>
            ) : (
              <>
                <p>{letter.closing}</p>
                <p className="font-medium">{letter.signatureName}</p>
              </>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
