import { useState } from 'react';
import {
  AlertCircle,
  BookmarkCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  SAMPLE_JOB_PRESETS,
  buildCoverLetterFromProfile,
  buildCvFromProfile,
} from '../data/presets';
import type {
  ApplicationStatus,
  ApplicationTone,
  CandidateProfile,
  DocumentTemplateConfig,
  OutputLanguage,
  TailoredCoverLetter,
  TailoredCv,
  TailoredPackage,
} from '../types/ausbildung';
import { postJson } from '../utils/api';
import { exportCombinedPdf } from '../utils/pdfExport';
import { CoverLetterSheet } from './CoverLetterSheet';
import { CvDocumentSheet } from './CvDocumentSheet';

type ResultSubTab = 'analysis' | 'cv' | 'letter';

interface TailorWorkspaceProps {
  profile: CandidateProfile;
  onUpdatePhoto: (photoUrl: string) => void;
  templateConfig: DocumentTemplateConfig;
  onChangeTemplateConfig: (next: DocumentTemplateConfig) => void;
  jobDescription: string;
  onChangeJobDescription: (val: string) => void;
  targetCompany: string;
  onChangeTargetCompany: (val: string) => void;
  targetRole: string;
  onChangeTargetRole: (val: string) => void;
  language: OutputLanguage;
  onChangeLanguage: (val: OutputLanguage) => void;
  tone: ApplicationTone;
  onChangeTone: (val: ApplicationTone) => void;
  activePackage: TailoredPackage | null;
  onChangePackage: (pkg: TailoredPackage | null) => void;
  activeAppId: string | null;
  activeStatus: ApplicationStatus;
  onChangeStatus: (status: ApplicationStatus) => void;
  onSaveApplication: () => void;
  onGoToProfile: () => void;
}

export function TailorWorkspace({
  profile,
  onUpdatePhoto,
  templateConfig,
  onChangeTemplateConfig,
  jobDescription,
  onChangeJobDescription,
  targetCompany,
  onChangeTargetCompany,
  targetRole,
  onChangeTargetRole,
  language,
  onChangeLanguage,
  tone,
  onChangeTone,
  activePackage,
  onChangePackage,
  activeAppId,
  activeStatus,
  onChangeStatus,
  onSaveApplication,
  onGoToProfile,
}: TailorWorkspaceProps) {
  const [subTab, setSubTab] = useState<ResultSubTab>('cv');
  const [inputExpanded, setInputExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isExportingCombined, setIsExportingCombined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Live template fallback from Base Profile prior to AI tailoring
  const previewCv: TailoredCv =
    activePackage?.tailoredCv ?? buildCvFromProfile(profile, targetRole);
  const previewLetter: TailoredCoverLetter =
    activePackage?.tailoredCoverLetter ??
    buildCoverLetterFromProfile(profile, targetCompany, targetRole);
  const effectiveCompany =
    activePackage?.jobAnalysis.companyName || targetCompany || 'Ausbildung';

  const handleTailor = async () => {
    if (!profile.fullName.trim()) {
      setError('Please enter your name and background in Base Profile before tailoring documents.');
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please paste an Ausbildung job description (Stellenanzeige) first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const data = await postJson<TailoredPackage>('/api/tailor', {
        profile,
        jobDescription,
        targetCompany: targetCompany.trim(),
        targetRole: targetRole.trim(),
        language,
        tone,
      });

      onChangePackage(data);
      setInputExpanded(false);
      setSubTab('cv');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while tailoring documents.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (customPrompt?: string) => {
    const instruction = (customPrompt ?? refineInstruction).trim();
    if (!instruction || !activePackage) return;

    setIsRefining(true);
    setError(null);
    try {
      const targetSection = subTab === 'cv' ? 'cv' : subTab === 'letter' ? 'coverLetter' : 'both';
      const data = await postJson<TailoredPackage>('/api/refine', {
        profile,
        jobDescription,
        currentPackage: activePackage,
        targetSection,
        instruction,
        language,
      });

      onChangePackage(data);
      if (!customPrompt) setRefineInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error while refining document.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleExportCombined = async () => {
    setIsExportingCombined(true);
    try {
      await exportCombinedPdf(
        previewCv,
        previewLetter,
        profile,
        templateConfig,
        effectiveCompany
      );
    } finally {
      setIsExportingCombined(false);
    }
  };

  const handleSave = () => {
    onSaveApplication();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const loadPreset = (presetId: string) => {
    const preset = SAMPLE_JOB_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChangeTargetCompany(preset.company);
    onChangeTargetRole(preset.role);
    onChangeJobDescription(preset.description);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Job Description Input Panel */}
      <section className="bg-white border border-slate-200 rounded-lg no-print">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              Job Posting &amp; Tailoring Setup
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose your CV &amp; Cover Letter template below, paste a German Stellenanzeige, and
              let AI rewrite the title, summary, experiences, and motivation letter for the role.
            </p>
          </div>
          {activePackage && (
            <button
              type="button"
              onClick={() => setInputExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {inputExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Hide Job Input
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Edit Job Input
                </>
              )}
            </button>
          )}
        </div>

        {inputExpanded && (
          <div className="p-6 space-y-5">
            {!profile.fullName.trim() && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4">
                <span>
                  Your Base Profile is currently empty. Add your schooling, internships, and
                  language levels so the documents reflect your real background.
                </span>
                <button
                  type="button"
                  onClick={onGoToProfile}
                  className="text-xs font-semibold text-amber-900 underline whitespace-nowrap shrink-0"
                >
                  Open Base Profile
                </button>
              </div>
            )}

            {/* Quick sample Stellenanzeigen */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 mr-1">Sample Job Ads:</span>
              {SAMPLE_JOB_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => loadPreset(preset.id)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">
                  Target Company (Optional)
                </span>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={(e) => onChangeTargetCompany(e.target.value)}
                  placeholder="Auto-detected from ad"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">
                  Target Ausbildungsberuf (Optional)
                </span>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => onChangeTargetRole(e.target.value)}
                  placeholder="Auto-detected from ad"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Document Language</span>
                <select
                  value={language}
                  onChange={(e) => onChangeLanguage(e.target.value as OutputLanguage)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="de_with_notes">Deutsch + English Summary</option>
                  <option value="de">Deutsch Only (Standard)</option>
                  <option value="en">English (International Firm)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Writing Tone</span>
                <select
                  value={tone}
                  onChange={(e) => onChangeTone(e.target.value as ApplicationTone)}
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="modern">Modern &amp; Motivated</option>
                  <option value="classic">Classic Formal (DIN Standard)</option>
                  <option value="technical">Technical &amp; Hands-On</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">
                Job Description (Stellenanzeige)
              </span>
              <textarea
                rows={7}
                value={jobDescription}
                onChange={(e) => onChangeJobDescription(e.target.value)}
                placeholder="Paste the full German or English Ausbildung job description here (including company address, contact person, tasks, and requirements)..."
                className="mt-1 w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
              />
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <p className="text-xs text-slate-500">
                Uses your Base Profile ({profile.fullName || 'Not set'}) without inventing fake
                experience.
              </p>
              <button
                type="button"
                onClick={handleTailor}
                disabled={isGenerating || !jobDescription.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing &amp; Tailoring...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze &amp; Tailor Documents
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Loading banner when generating */}
      {isGenerating && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-3 no-print">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-900">
            <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
            <span>
              Analyzing job requirements and rewriting your CV &amp; Motivation Letter template...
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="h-16 bg-slate-100 rounded animate-pulse" />
            <div className="h-16 bg-slate-100 rounded animate-pulse" />
            <div className="h-16 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Tailored Role Summary & Save/Full-PDF Strip */}
      {activePackage && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {activePackage.jobAnalysis.roleTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 mt-1">
              <span className="font-medium text-slate-900">
                {activePackage.jobAnalysis.companyName}
              </span>
              {activePackage.jobAnalysis.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{activePackage.jobAnalysis.location}</span>
                </>
              )}
              {activePackage.jobAnalysis.startDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    Start: {activePackage.jobAnalysis.startDate}
                  </span>
                </>
              )}
              {activePackage.jobAnalysis.duration && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{activePackage.jobAnalysis.duration}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              aria-label="Application status"
              value={activeStatus}
              onChange={(e) => onChangeStatus(e.target.value as ApplicationStatus)}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="draft">Status: Draft</option>
              <option value="ready">Status: Ready to Send</option>
              <option value="applied">Status: Applied</option>
              <option value="interview">Status: Interview</option>
            </select>

            <button
              type="button"
              onClick={handleExportCombined}
              disabled={isExportingCombined}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {isExportingCombined ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              Export Full PDF
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <BookmarkCheck className="h-4 w-4" />
              {justSaved ? 'Saved' : activeAppId ? 'Update Saved' : 'Save Application'}
            </button>
          </div>
        </div>
      )}

      {/* Document & Analysis Segmented Tabs (always accessible so templates can be previewed & customized!) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('cv')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'cv'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lebenslauf (CV)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('letter')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'letter'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Anschreiben (Motivation Letter)
          </button>
          {activePackage && (
            <button
              type="button"
              onClick={() => setSubTab('analysis')}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'analysis'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Analysis &amp; Match
            </button>
          )}
        </div>

        {!activePackage && (
          <button
            type="button"
            onClick={handleExportCombined}
            disabled={isExportingCombined}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export Template PDF
          </button>
        )}
      </div>

      {/* Tab 1: Lebenslauf Template */}
      {subTab === 'cv' && (
        <div className="space-y-5">
          <CvDocumentSheet
            cv={previewCv}
            profile={profile}
            companyName={effectiveCompany}
            templateConfig={templateConfig}
            isTailored={Boolean(activePackage)}
            onChangeTemplateConfig={onChangeTemplateConfig}
            onUpdatePhoto={onUpdatePhoto}
            onUpdateCv={(nextCv) => {
              if (activePackage) {
                onChangePackage({ ...activePackage, tailoredCv: nextCv });
              }
            }}
          />

          {activePackage && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 max-w-[820px] mx-auto space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Refine Lebenslauf with AI
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Make bullets more concise',
                    'Emphasize school subjects & grades',
                    'Highlight teamwork and reliability',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefine(quick)}
                      className="px-2.5 py-1 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="e.g., Emphasize my Linux experience and keep Kurzprofil to two sentences..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  disabled={isRefining || !refineInstruction.trim()}
                  onClick={() => handleRefine()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isRefining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Apply Refinement
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Anschreiben Template */}
      {subTab === 'letter' && (
        <div className="space-y-5">
          <CoverLetterSheet
            letter={previewLetter}
            companyName={effectiveCompany}
            templateConfig={templateConfig}
            isTailored={Boolean(activePackage)}
            onChangeTemplateConfig={onChangeTemplateConfig}
            onUpdateLetter={(nextLetter) => {
              if (activePackage) {
                onChangePackage({ ...activePackage, tailoredCoverLetter: nextLetter });
              }
            }}
          />

          {activePackage && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 max-w-[820px] mx-auto space-y-3 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  Refine Anschreiben with AI
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Shorten to ~250 words for 1-page DIN fit',
                    'Make the opening sentence more natural and company-specific',
                    'Emphasize German language readiness and motivation',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      disabled={isRefining}
                      onClick={() => handleRefine(quick)}
                      className="px-2.5 py-1 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
                    >
                      {quick}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  placeholder="e.g., Mention my enthusiasm for hands-on problem solving in paragraph 2..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  disabled={isRefining || !refineInstruction.trim()}
                  onClick={() => handleRefine()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isRefining ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Apply Refinement
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Analysis & Match */}
      {subTab === 'analysis' && activePackage && (
        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Role Overview &amp; Key Requirements
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {activePackage.jobAnalysis.overview}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-3 border-t border-slate-200 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Technical &amp; School Skills
                </p>
                <p className="text-slate-800 leading-relaxed">
                  {activePackage.jobAnalysis.hardSkills.join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Soft Skills (Kompetenzen)
                </p>
                <p className="text-slate-800 leading-relaxed">
                  {activePackage.jobAnalysis.softSkills.join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Language &amp; Contact
                </p>
                <p className="text-slate-800">
                  {activePackage.jobAnalysis.languageRequirement || 'Not specified'}
                </p>
                {activePackage.jobAnalysis.recipientContact && (
                  <p className="text-xs text-slate-500 mt-1">
                    Contact: {activePackage.jobAnalysis.recipientContact}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Requirement-to-Profile Alignment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Shows how each job requirement maps to your real profile without fabricating credentials.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-6">Job Requirement</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Evidence from Base Profile</th>
                    <th className="py-3 px-6 text-right">Alignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {activePackage.jobAnalysis.requirementMatches.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6 font-medium text-slate-900">{row.requirement}</td>
                      <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {row.category}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{row.evidenceFromProfile}</td>
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        {row.strength === 'strong' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Strong Match
                          </span>
                        )}
                        {row.strength === 'transferable' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Transferable
                          </span>
                        )}
                        {row.strength === 'gap' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Missing / Gap
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                What Was Tailored in Your Template
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 list-disc pl-4">
                {activePackage.tailoringNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </section>

            <section className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="font-display text-sm font-semibold text-slate-900 mb-3">
                Gaps &amp; Recommended Next Steps
              </h3>
              {activePackage.jobAnalysis.gapsOrActionItems.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No critical gaps detected against this posting.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-700 list-disc pl-4">
                  {activePackage.jobAnalysis.gapsOrActionItems.map((gap, idx) => (
                    <li key={idx}>{gap}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
