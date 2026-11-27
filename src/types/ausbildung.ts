export type OutputLanguage = 'de' | 'de_with_notes' | 'en';

export type ApplicationTone = 'classic' | 'modern' | 'technical';

export type ApplicationStatus = 'draft' | 'ready' | 'applied' | 'interview';

export type DocumentTemplateId = 'europass_ats' | 'classic_berlin' | 'minimalist_bauhaus';

export type TemplateAccentId = 'europass' | 'slate' | 'pine' | 'burgundy';

export interface DocumentTemplateConfig {
  templateId: DocumentTemplateId;
  accent: TemplateAccentId;
  showPhoto: boolean;
  showPersonalMeta: boolean;
}

export interface ExperienceItem {
  id: string;
  period: string;
  role: string;
  organization: string;
  location: string;
  highlights: string;
}

export interface EducationItem {
  id: string;
  period: string;
  degree: string;
  institution: string;
  location: string;
  details: string;
}

export interface LanguageItem {
  id: string;
  language: string;
  level: string;
}

export interface CandidateProfile {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  postalCity: string;
  birthInfo: string;
  nationality: string;
  availability: string;
  linkedInOrPortfolio: string;
  photoUrl?: string;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string;
  languages: LanguageItem[];
  interests: string;
}

export interface RequirementMatch {
  requirement: string;
  category: string;
  evidenceFromProfile: string;
  strength: 'strong' | 'transferable' | 'gap';
}

export interface MatchNotification {
  id: string;
  title: string;
  companyName: string;
  read: string;
  matchScore: number;
  location: string;
  isNewListing: boolean;
  matchedAppLabel: string;
  jobDescription: string;
}

export interface JobAnalysis {
  roleTitle: string;
  companyName: string;
  recipientContact: string;
  recipientAddress: string;
  location: string;
  startDate: string;
  duration: string;
  overview: string;
  hardSkills: string[];
  softSkills: string[];
  languageRequirement: string;
  requirementMatches: RequirementMatch[];
  gapsOrActionItems: string[];
}

export interface TailoredCvExperience {
  period: string;
  role: string;
  organization: string;
  location: string;
  bullets: string[];
}

export interface TailoredCvEducation {
  period: string;
  degree: string;
  institution: string;
  location: string;
  details: string;
}

export interface TailoredCvSkillGroup {
  category: string;
  items: string[];
}

export interface TailoredCv {
  headline: string;
  profileStatement: string;
  experience: TailoredCvExperience[];
  education: TailoredCvEducation[];
  skills: TailoredCvSkillGroup[];
  languages: { language: string; level: string }[];
  interests: string;
}

export interface TailoredCoverLetter {
  senderBlock: string;
  recipientBlock: string;
  datePlaceLine: string;
  subjectLine: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  signatureName: string;
  englishSummary: string;
}

export interface TailoredPackage {
  jobAnalysis: JobAnalysis;
  tailoredCv: TailoredCv;
  tailoredCoverLetter: TailoredCoverLetter;
  tailoringNotes: string[];
}

export interface SavedApplication {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ApplicationStatus;
  language: OutputLanguage;
  tone: ApplicationTone;
  templateConfig?: DocumentTemplateConfig;
  jobDescription: string;
  packageData: TailoredPackage;
}
