import type {
  CandidateProfile,
  DocumentTemplateConfig,
  DocumentTemplateId,
  TailoredCoverLetter,
  TailoredCv,
  TemplateAccentId,
} from '../types/ausbildung';

export const SAMPLE_PORTRAIT_PATH =
  '/src/assets/images/sample_applicant_portrait_1795784784654.jpg';

export const DEFAULT_TEMPLATE_CONFIG: DocumentTemplateConfig = {
  templateId: 'europass_ats',
  accent: 'europass',
  showPhoto: true,
  showPersonalMeta: true,
};

export const TEMPLATE_OPTIONS: {
  id: DocumentTemplateId;
  name: string;
  subtitle: string;
}[] = [
  {
    id: 'europass_ats',
    name: 'أوروباس (متوافق مع ATS)',
    subtitle: 'النموذج الأوروبي المعتمد في ألمانيا بعمود واحد يقرأه نظام الشركات بسهولة',
  },
  {
    id: 'classic_berlin',
    name: 'ألماني كلاسيكي',
    subtitle: 'تنسيق ألماني تقليدي منظم بعمود واحد متوافق مع الأنظمة الآلية',
  },
  {
    id: 'minimalist_bauhaus',
    name: 'بسيط وحديث',
    subtitle: 'تصميم خفيف وواضح بعمود واحد للتركيز على المحتوى',
  },
];

export const ACCENT_OPTIONS: {
  id: TemplateAccentId;
  label: string;
  hex: string;
  rgb: [number, number, number];
}[] = [
  { id: 'europass', label: 'أزرق أوروباس', hex: '#004494', rgb: [0, 68, 148] },
  { id: 'slate', label: 'رمادي داكن', hex: '#0F172A', rgb: [15, 23, 42] },
  { id: 'pine', label: 'أخضر هادئ', hex: '#0F766E', rgb: [15, 118, 110] },
  { id: 'burgundy', label: 'عنابي كلاسيكي', hex: '#991B1B', rgb: [153, 27, 27] },
];

export function getAccentMeta(accentId: TemplateAccentId | string) {
  return ACCENT_OPTIONS.find((item) => item.id === accentId) ?? ACCENT_OPTIONS[0];
}

export const SAMPLE_PROFILE: CandidateProfile = {
  fullName: 'Lukas Bergmann',
  email: 'lukas.bergmann@example.de',
  phone: '+49 176 48201934',
  streetAddress: 'Schillerstraße 28',
  postalCity: '40237 Düsseldorf',
  birthInfo: '14.05.2006 in Essen',
  nationality: 'Deutsch',
  availability: 'Ab 01.08.2027',
  linkedInOrPortfolio: 'github.com/lukas-bergmann-dev',
  photoUrl: SAMPLE_PORTRAIT_PATH,
  summary:
    'Engagierter Realschulabsolvent mit ausgeprägtem Interesse an Informatik, logischem Denken und praktischer Problemlösung. Erste Praxiserfahrung durch ein Schülerbetriebspraktikum in der IT-Abteilung sowie eigene Web- und Python-Projekte.',
  experience: [
    {
      id: 'exp-1',
      period: '03/2026 – 04/2026',
      role: 'Schülerbetriebspraktikum IT-Support & Webentwicklung',
      organization: 'RheinWerk Systems GmbH',
      location: 'Düsseldorf',
      highlights:
        'Einrichtung von Arbeitsplätzen (Windows 11, Linux), Unterstützung beim First-Level-Support und Pflege interner HTML/CSS-Dokumentationsseiten. Lob für schnelle Auffassungsgabe und sorgfältige Arbeitsweise.',
    },
    {
      id: 'exp-2',
      period: '09/2024 – heute',
      role: 'Leiter der Informatik-AG (Ehrenamt)',
      organization: 'Goethe-Realschule Düsseldorf',
      location: 'Düsseldorf',
      highlights:
        'Begleitung jüngerer Schülerinnen und Schüler bei ersten Schritten in Python und HTML, Organisation von kleinen Programmier-Workshops im Team.',
    },
  ],
  education: [
    {
      id: 'edu-1',
      period: '08/2021 – 06/2027',
      degree: 'Mittlerer Schulabschluss (Fachoberschulreife, voraussichtlich)',
      institution: 'Goethe-Realschule',
      location: 'Düsseldorf',
      details: 'Schwerpunktfächer: Mathematik (Note 2), Informatik (Note 1), Englisch (Note 2)',
    },
  ],
  skills:
    'Python (Grundlagen), HTML5 & CSS3, JavaScript (Grundlagen), Git, Microsoft Office (Word, Excel, PowerPoint), Windows & Ubuntu Linux, Teamfähigkeit, Zuverlässigkeit, strukturiertes Arbeiten',
  languages: [
    { id: 'lang-1', language: 'Deutsch', level: 'Muttersprache (C2)' },
    { id: 'lang-2', language: 'Englisch', level: 'Gute Kenntnisse (B2)' },
  ],
  interests: 'Eigene kleine Automatisierungs-Skripte, Schachverein, Fahrradfahren',
};

export const EMPTY_PROFILE: CandidateProfile = {
  fullName: '',
  email: '',
  phone: '',
  streetAddress: '',
  postalCity: '',
  birthInfo: '',
  nationality: '',
  availability: '',
  linkedInOrPortfolio: '',
  photoUrl: '',
  summary: '',
  experience: [],
  education: [],
  skills: '',
  languages: [{ id: 'lang-1', language: 'Deutsch', level: 'B2' }],
  interests: '',
};

export function buildCvFromProfile(profile: CandidateProfile, targetRole?: string): TailoredCv {
  const skillList = profile.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    headline: targetRole
      ? `Ausbildungsbewerbung: ${targetRole}`
      : 'Bewerber um einen Ausbildungsplatz',
    profileStatement:
      profile.summary ||
      'Motivierte und zuverlässige Persönlichkeit mit großem Interesse an einer praxisnahen Ausbildung in Deutschland.',
    experience: profile.experience.map((exp) => ({
      period: exp.period,
      role: exp.role || 'Praktikum / Erfahrung',
      organization: exp.organization,
      location: exp.location,
      bullets: exp.highlights
        ? exp.highlights
            .split(/[.;]\s+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    })),
    education: profile.education.map((edu) => ({
      period: edu.period,
      degree: edu.degree,
      institution: edu.institution,
      location: edu.location,
      details: edu.details,
    })),
    skills:
      skillList.length > 0
        ? [{ category: 'Fachliche & Digitale Kompetenzen', items: skillList }]
        : [],
    languages: profile.languages.map((l) => ({
      language: l.language,
      level: l.level,
    })),
    interests: profile.interests,
  };
}

export function buildCoverLetterFromProfile(
  profile: CandidateProfile,
  targetCompany?: string,
  targetRole?: string
): TailoredCoverLetter {
  const city = profile.postalCity ? profile.postalCity.replace(/^\d+\s*/, '') : 'Deutschland';
  const today = new Date().toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const roleLabel = targetRole || 'Ausbildungsplatz';
  const companyLabel = targetCompany || 'Ihr Unternehmen';

  return {
    senderBlock: [
      profile.fullName || 'Ihr Name',
      profile.streetAddress,
      profile.postalCity,
      profile.phone,
      profile.email,
    ]
      .filter(Boolean)
      .join('\n'),
    recipientBlock: `${companyLabel}\nPersonalabteilung`,
    datePlaceLine: `${city}, ${today}`,
    subjectLine: `Bewerbung um einen Ausbildungsplatz: ${roleLabel}`,
    salutation: 'Sehr geehrte Damen und Herren,',
    paragraphs: [
      `mit großem Interesse habe ich Ihre Ausschreibung bei ${companyLabel} gelesen. Gerne möchte ich mein Engagement und meine Fähigkeiten in eine Ausbildung als ${roleLabel} in Ihrem Unternehmen einbringen.`,
      profile.summary ||
        'Durch meine schulische Laufbahn und erste praktische Erfahrungen konnte ich mir eine strukturierte Arbeitsweise, Zuverlässigkeit und Teamfähigkeit aneignen.',
      `Gern überzeuge ich Sie in einem persönlichen Vorstellungsgespräch von meiner Motivation. Ich stehe Ihnen ${
        profile.availability || 'zum gewünschten Ausbildungsbeginn'
      } zur Verfügung.`,
    ],
    closing: 'Mit freundlichen Grüßen',
    signatureName: profile.fullName || 'Ihr Name',
    englishSummary:
      'هذا نموذج أولي من بيانات ملفك الشخصي. بعد لصق إعلان الوظيفة والضغط على زر التجهيز، سيقوم الذكاء الاصطناعي بإعادة صياغة العنوان والنبذة والخبرات ورسالة الدافع لتناسب الوظيفة المطلوبة مع شرحها هنا بالعربية.',
  };
}

export interface SampleJobPreset {
  id: string;
  label: string;
  company: string;
  role: string;
  description: string;
}


