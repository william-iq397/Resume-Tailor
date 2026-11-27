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
  const [showArabicSummary, setShowArabicSummary] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const accent = getAccentMeta(templateConfig.accent);
  const isEuropass = templateConfig.templateId === 'europass_ats';
  const isBauhaus = templateConfig.templateId === 'minimalist_bauhaus';
  const wordCount = countCoverLetterWords(letter);
  const pageFitText =
    wordCount <= 340
      ? 'طول مثالي لصفحة A4 واحدة'
      : 'طويلة قليلاً — يفضل تقصيرها لتناسب صفحة واحدة';

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
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#162133] border border-slate-200 dark:border-[#2A3B56] rounded-lg px-4 py-3 no-print">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-[#9FB0C7]">
          <span className="font-semibold text-slate-900 dark:text-[#EEF2F8]">
            {isEuropass ? 'رسالة الدافع (Europass / DIN 5008)' : 'رسالة الدافع'}
          </span>
          <span aria-hidden="true">·</span>
          <span>{isTailored ? 'معدلة للإعلان' : 'معاينة أولية'}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{wordCount} كلمة</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              wordCount <= 340
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-amber-700 dark:text-amber-400 font-medium'
            }
          >
            {pageFitText}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {letter.englishSummary && (
            <button
              type="button"
              onClick={() => setShowArabicSummary((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                showArabicSummary
                  ? 'bg-slate-100 dark:bg-[#1D2B42] text-slate-900 dark:text-white border-slate-300 dark:border-[#3A4F73]'
                  : 'bg-white dark:bg-[#1D2B42] text-slate-700 dark:text-[#EEF2F8] border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              الشرح بالعربية
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditing((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              isEditing
                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                : 'bg-white dark:bg-[#1D2B42] text-slate-700 dark:text-[#EEF2F8] border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#243652]'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            {isEditing ? 'إنهاء التعديل' : 'تعديل الرسالة'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'تم النسخ' : 'نسخ النص'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-[#EEF2F8] bg-white dark:bg-[#1D2B42] border border-slate-200 dark:border-[#2A3B56] hover:bg-slate-50 dark:hover:bg-[#243652] rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" />
            طباعة
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            {isExportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            تحميل PDF
          </button>
        </div>
      </div>

      {showArabicSummary && letter.englishSummary && (
        <div className="bg-teal-50/70 dark:bg-[#162133] border border-teal-200 dark:border-[#2A3B56] rounded-lg px-5 py-4 max-w-[820px] mx-auto no-print">
          <p className="text-xs font-semibold text-teal-900 dark:text-teal-300 mb-1">
            ملخص محتوى الرسالة بالعربية (لتفهم كل ما كُتب بالألمانية)
          </p>
          <p className="text-sm text-slate-700 dark:text-[#C5D1E0] leading-relaxed">
            {letter.englishSummary}
          </p>
        </div>
      )}

      {/* Single-column ATS-safe Europass / DIN 5008 Anschreiben (always LTR white paper) */}
      <article
        dir="ltr"
        className="bg-white border border-slate-200 dark:border-[#2A3B56] rounded-lg overflow-hidden max-w-[820px] mx-auto text-slate-900 text-left print-only-sheet"
      >
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

          {/* Sender Block */}
          <div className="whitespace-pre-line text-xs text-slate-600 leading-relaxed mb-6 pb-4 border-b border-slate-200">
            {isEditing ? (
              <textarea
                rows={4}
                value={letter.senderBlock}
                onChange={(e) => onUpdateLetter({ ...letter, senderBlock: e.target.value })}
                className="w-full sm:w-80 p-2 text-xs border border-teal-400 rounded bg-teal-50/40"
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
                className="w-full sm:w-80 p-2 text-sm border border-teal-400 rounded bg-teal-50/40"
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
                className="px-2 py-1 text-sm text-right border border-teal-400 rounded bg-teal-50/40"
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
                className="w-full px-2.5 py-1.5 text-base font-bold border border-teal-400 rounded bg-teal-50/40"
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
                className="w-full px-2.5 py-1 text-sm border border-teal-400 rounded bg-teal-50/40"
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
                className="w-full p-3 text-sm leading-6 border border-teal-400 rounded bg-teal-50/40"
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
                  className="w-full px-2.5 py-1 text-sm border border-teal-400 rounded bg-teal-50/40"
                />
                <input
                  type="text"
                  value={letter.signatureName}
                  onChange={(e) => onUpdateLetter({ ...letter, signatureName: e.target.value })}
                  className="w-full px-2.5 py-1 text-sm border border-teal-400 rounded bg-teal-50/40"
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
