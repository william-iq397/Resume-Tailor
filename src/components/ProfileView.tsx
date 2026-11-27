import { useRef, useState } from 'react';
import { Camera, Loader2, Plus, Trash2, Upload, User } from 'lucide-react';
import { EMPTY_PROFILE, SAMPLE_PROFILE } from '../data/presets';
import type {
  CandidateProfile,
  EducationItem,
  ExperienceItem,
  LanguageItem,
} from '../types/ausbildung';
import { postJson } from '../utils/api';

interface ProfileViewProps {
  profile: CandidateProfile;
  onChange: (next: CandidateProfile) => void;
  onGoToTailor: () => void;
}

async function resizeImageFileToDataUrl(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
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

export function ProfileView({ profile, onChange, onGoToTailor }: ProfileViewProps) {
  const [showImport, setShowImport] = useState(false);
  const [rawCvText, setRawCvText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateField = <K extends keyof CandidateProfile>(key: K, value: CandidateProfile[K]) => {
    onChange({ ...profile, [key]: value });
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      setPhotoLoadError(false);
      updateField('photoUrl', dataUrl);
      setStatusMessage('Bewerbungsfoto updated in your Base Profile and CV templates.');
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to load photo.');
    }
  };

  const addExperience = () => {
    const next: ExperienceItem = {
      id: `exp-${Date.now()}`,
      period: '',
      role: '',
      organization: '',
      location: '',
      highlights: '',
    };
    updateField('experience', [...profile.experience, next]);
  };

  const updateExperience = (id: string, patch: Partial<ExperienceItem>) => {
    updateField(
      'experience',
      profile.experience.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeExperience = (id: string) => {
    updateField(
      'experience',
      profile.experience.filter((item) => item.id !== id)
    );
  };

  const addEducation = () => {
    const next: EducationItem = {
      id: `edu-${Date.now()}`,
      period: '',
      degree: '',
      institution: '',
      location: '',
      details: '',
    };
    updateField('education', [...profile.education, next]);
  };

  const updateEducation = (id: string, patch: Partial<EducationItem>) => {
    updateField(
      'education',
      profile.education.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeEducation = (id: string) => {
    updateField(
      'education',
      profile.education.filter((item) => item.id !== id)
    );
  };

  const addLanguage = () => {
    const next: LanguageItem = {
      id: `lang-${Date.now()}`,
      language: '',
      level: 'B2',
    };
    updateField('languages', [...profile.languages, next]);
  };

  const updateLanguage = (id: string, patch: Partial<LanguageItem>) => {
    updateField(
      'languages',
      profile.languages.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const removeLanguage = (id: string) => {
    updateField(
      'languages',
      profile.languages.filter((item) => item.id !== id)
    );
  };

  const handleParseCv = async () => {
    if (!rawCvText.trim()) return;
    setIsParsing(true);
    setParseError(null);
    setStatusMessage(null);
    try {
      const data = await postJson<{
        fullName?: string;
        email?: string;
        phone?: string;
        streetAddress?: string;
        postalCity?: string;
        birthInfo?: string;
        nationality?: string;
        availability?: string;
        linkedInOrPortfolio?: string;
        summary?: string;
        experience?: Omit<ExperienceItem, 'id'>[];
        education?: Omit<EducationItem, 'id'>[];
        skills?: string;
        languages?: Omit<LanguageItem, 'id'>[];
        interests?: string;
      }>('/api/parse-cv', { rawText: rawCvText });

      onChange({
        ...profile,
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        streetAddress: data.streetAddress || '',
        postalCity: data.postalCity || '',
        birthInfo: data.birthInfo || '',
        nationality: data.nationality || '',
        availability: data.availability || '',
        linkedInOrPortfolio: data.linkedInOrPortfolio || '',
        summary: data.summary || '',
        experience: Array.isArray(data.experience)
          ? data.experience.map((e, idx) => ({
              ...e,
              id: `exp-${Date.now()}-${idx}`,
            }))
          : [],
        education: Array.isArray(data.education)
          ? data.education.map((e, idx) => ({
              ...e,
              id: `edu-${Date.now()}-${idx}`,
            }))
          : [],
        skills: data.skills || '',
        languages: Array.isArray(data.languages)
          ? data.languages.map((l, idx) => ({
              ...l,
              id: `lang-${Date.now()}-${idx}`,
            }))
          : [],
        interests: data.interests || '',
      });
      setShowImport(false);
      setRawCvText('');
      setStatusMessage('Profile populated from your pasted CV. Review any details below.');
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CV.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Candidate Base Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Your master source of truth. Every tailored Lebenslauf and Anschreiben draws only from
            verified details stored here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowImport((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="h-4 w-4 text-slate-500" />
            Import from CV
          </button>
          <button
            type="button"
            onClick={() => {
              setPhotoLoadError(false);
              onChange(SAMPLE_PROFILE);
              setStatusMessage('Loaded sample Ausbildung applicant profile.');
            }}
            className="px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            Load Sample
          </button>
          <button
            type="button"
            onClick={() => {
              setPhotoLoadError(false);
              onChange(EMPTY_PROFILE);
              setStatusMessage('Profile cleared. Enter your own background or import an existing CV.');
            }}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:text-red-600 hover:border-red-200 rounded-lg transition-colors whitespace-nowrap"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onGoToTailor}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap"
          >
            Tailor Application
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {showImport && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Import from Existing CV or Resume
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Paste text from your existing resume (German or English) to extract structured
                fields automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>
          <textarea
            rows={7}
            value={rawCvText}
            onChange={(e) => setRawCvText(e.target.value)}
            placeholder="Paste your current CV / Lebenslauf text here..."
            className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
          {parseError && <p className="text-sm text-red-600">{parseError}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleParseCv}
              disabled={isParsing || !rawCvText.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {isParsing && <Loader2 className="h-4 w-4 animate-spin" />}
              {isParsing ? 'Extracting Profile...' : 'Extract & Populate'}
            </button>
          </div>
        </div>
      )}

      {/* Personal Details Section */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Personal Details &amp; CV Photo (Persönliche Daten)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Used for the DIN 5008 Anschreiben header and Lebenslauf template.
          </p>
        </div>

        {/* Bewerbungsfoto upload row */}
        <div className="flex flex-wrap items-center gap-5 pb-4 border-b border-slate-100">
          <div className="h-24 w-20 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
            {profile.photoUrl && !photoLoadError ? (
              <img
                src={profile.photoUrl}
                alt={profile.fullName || 'Candidate portrait'}
                referrerPolicy="no-referrer"
                onError={() => setPhotoLoadError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-8 w-8 text-slate-400" />
            )}
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-slate-900">
                CV Portrait Photo (Bewerbungsfoto)
              </p>
              <p className="text-xs text-slate-500">
                Optional in Germany, recommended for many Ausbildung applications. Included in your
                CV template and exported PDF.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  handlePhotoUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <Camera className="h-3.5 w-3.5 text-slate-500" />
                Upload Photo
              </button>
              {profile.photoUrl && (
                <button
                  type="button"
                  onClick={() => updateField('photoUrl', '')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 rounded-lg"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Full Name</span>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              placeholder="e.g., Lukas Bergmann"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="name@example.de"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Phone</span>
            <input
              type="text"
              value={profile.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+49 176 ..."
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Street &amp; House No.</span>
            <input
              type="text"
              value={profile.streetAddress}
              onChange={(e) => updateField('streetAddress', e.target.value)}
              placeholder="Schillerstraße 28"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Postal Code &amp; City</span>
            <input
              type="text"
              value={profile.postalCity}
              onChange={(e) => updateField('postalCity', e.target.value)}
              placeholder="40237 Düsseldorf"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Earliest Start / Availability</span>
            <input
              type="text"
              value={profile.availability}
              onChange={(e) => updateField('availability', e.target.value)}
              placeholder="Ab 01.08.2027 / Sofort"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Birth Date &amp; Place (Optional)</span>
            <input
              type="text"
              value={profile.birthInfo}
              onChange={(e) => updateField('birthInfo', e.target.value)}
              placeholder="14.05.2006 in Essen"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Nationality / Visa Note (Optional)</span>
            <input
              type="text"
              value={profile.nationality}
              onChange={(e) => updateField('nationality', e.target.value)}
              placeholder="Deutsch / Aufenthaltserlaubnis"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Portfolio / GitHub (Optional)</span>
            <input
              type="text"
              value={profile.linkedInOrPortfolio}
              onChange={(e) => updateField('linkedInOrPortfolio', e.target.value)}
              placeholder="github.com/username"
              className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">
            Background Summary (Kurzprofil / Motivation Base)
          </span>
          <textarea
            rows={3}
            value={profile.summary}
            onChange={(e) => updateField('summary', e.target.value)}
            placeholder="Summarize your schooling, key strengths, and career direction..."
            className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
      </section>

      {/* Experience & Internships Section */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              02. Experience, Internships &amp; Volunteering (Praktika &amp; Engagement)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Include school internships (Schülerbetriebspraktikum), part-time jobs, clubs, or projects.
            </p>
          </div>
          <button
            type="button"
            onClick={addExperience}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Entry
          </button>
        </div>

        {profile.experience.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">
            No practical entries added yet. Add internships, part-time work, school projects, or volunteer roles.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {profile.experience.map((item) => (
              <div key={item.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Period</span>
                    <input
                      type="text"
                      value={item.period}
                      onChange={(e) => updateExperience(item.id, { period: e.target.value })}
                      placeholder="03/2026 – 04/2026"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700">Role / Activity</span>
                    <input
                      type="text"
                      value={item.role}
                      onChange={(e) => updateExperience(item.id, { role: e.target.value })}
                      placeholder="Schülerbetriebspraktikum IT-Support"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="text-xs font-medium text-slate-700">City</span>
                      <input
                        type="text"
                        value={item.location}
                        onChange={(e) => updateExperience(item.id, { location: e.target.value })}
                        placeholder="Düsseldorf"
                        className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeExperience(item.id)}
                      aria-label="Remove experience entry"
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Company / Organization</span>
                    <input
                      type="text"
                      value={item.organization}
                      onChange={(e) => updateExperience(item.id, { organization: e.target.value })}
                      placeholder="RheinWerk Systems GmbH"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700">Tasks &amp; Achievements</span>
                    <input
                      type="text"
                      value={item.highlights}
                      onChange={(e) => updateExperience(item.id, { highlights: e.target.value })}
                      placeholder="What you did, tools used, feedback received..."
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Education Section */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              03. Education &amp; Schooling (Schulbildung)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Include school type, expected or earned certificate (e.g., Realschulabschluss, Abitur), and strong subjects.
            </p>
          </div>
          <button
            type="button"
            onClick={addEducation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add School
          </button>
        </div>

        {profile.education.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No school entries added yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {profile.education.map((edu) => (
              <div key={edu.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Period</span>
                    <input
                      type="text"
                      value={edu.period}
                      onChange={(e) => updateEducation(edu.id, { period: e.target.value })}
                      placeholder="08/2021 – 06/2027"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700">Certificate / Degree</span>
                    <input
                      type="text"
                      value={edu.degree}
                      onChange={(e) => updateEducation(edu.id, { degree: e.target.value })}
                      placeholder="Mittlerer Schulabschluss (Fachoberschulreife)"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="block flex-1">
                      <span className="text-xs font-medium text-slate-700">City</span>
                      <input
                        type="text"
                        value={edu.location}
                        onChange={(e) => updateEducation(edu.id, { location: e.target.value })}
                        placeholder="Düsseldorf"
                        className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEducation(edu.id)}
                      aria-label="Remove education entry"
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">School / University</span>
                    <input
                      type="text"
                      value={edu.institution}
                      onChange={(e) => updateEducation(edu.id, { institution: e.target.value })}
                      placeholder="Goethe-Realschule"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-xs font-medium text-slate-700">Focus Subjects / Grades</span>
                    <input
                      type="text"
                      value={edu.details}
                      onChange={(e) => updateEducation(edu.id, { details: e.target.value })}
                      placeholder="Schwerpunktfächer: Mathematik (2), Informatik (1), Englisch (2)"
                      className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Skills, Languages & Interests */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            04. Skills, Languages &amp; Interests (Kenntnisse &amp; Sprachen)
          </h2>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">
            Technical, Office &amp; Soft Skills (comma-separated)
          </span>
          <textarea
            rows={2}
            value={profile.skills}
            onChange={(e) => updateField('skills', e.target.value)}
            placeholder="Python, HTML/CSS, MS Office, Teamfähigkeit, Zuverlässigkeit..."
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Languages (CEFR Level)</span>
            <button
              type="button"
              onClick={addLanguage}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Language
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {profile.languages.map((lang) => (
              <div key={lang.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={lang.language}
                  onChange={(e) => updateLanguage(lang.id, { language: e.target.value })}
                  placeholder="Deutsch"
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="text"
                  value={lang.level}
                  onChange={(e) => updateLanguage(lang.id, { level: e.target.value })}
                  placeholder="B2 / C1 / Muttersprache"
                  className="w-44 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => removeLanguage(lang.id)}
                  aria-label="Remove language"
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-slate-700">Interests (Interessen)</span>
          <input
            type="text"
            value={profile.interests}
            onChange={(e) => updateField('interests', e.target.value)}
            placeholder="Schachverein, Elektronik-Basteln, Vereinsfußball..."
            className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </label>
      </section>
    </div>
  );
}
