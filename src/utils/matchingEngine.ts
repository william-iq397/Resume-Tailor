import type {
  AusbildungOpportunity,
  CandidateCertificatesMap,
  CandidateProfile,
  OpportunityMatchResult,
  SavedApplication,
} from '../types/ausbildung';

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

const STOP_WORDS = new Set([
  'ausbildung',
  'mwd',
  'und',
  'oder',
  'für',
  'mit',
  'von',
  'bei',
  'zum',
  'zur',
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'einen',
  'als',
  'auf',
  'den',
  'dem',
  'des',
  'im',
  'in',
  'an',
  'the',
  'and',
  'for',
  'with',
]);

function extractKeywords(text: string): Set<string> {
  const result = new Set<string>();
  for (const tok of tokenize(text)) {
    if (!STOP_WORDS.has(tok)) result.add(tok);
  }
  return result;
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const token of a) {
    if (b.has(token)) hits += 1;
  }
  return hits / Math.min(a.size, 8);
}

function extractCityName(locationText: string): string {
  return (locationText || '')
    .replace(/\d{5}/g, '')
    .split(/[,/|]/)[0]
    .trim()
    .toLowerCase();
}

export function evaluateOpportunityMatch(
  opportunity: AusbildungOpportunity,
  profile: CandidateProfile,
  savedApplications: SavedApplication[],
  certificates?: CandidateCertificatesMap
): OpportunityMatchResult {
  const oppText = [
    opportunity.title,
    opportunity.occupation,
    opportunity.companyName,
    opportunity.location,
    opportunity.description || '',
  ].join(' ');
  const oppKeywords = extractKeywords(oppText);

  const profileText = [
    profile.summary,
    profile.skills,
    profile.interests,
    ...profile.experience.map((e) => `${e.role} ${e.highlights} ${e.organization}`),
    ...profile.education.map((e) => `${e.degree} ${e.details}`),
    ...profile.languages.map((l) => `${l.language} ${l.level}`),
  ].join(' ');
  const profileKeywords = extractKeywords(profileText);

  // Base profile compatibility (up to 48 pts)
  const profileOverlap = Math.min(1, overlapRatio(oppKeywords, profileKeywords));
  let profileScore = Math.round(profileOverlap * 38);

  // German language bonus (up to 16 pts)
  const germanLang = profile.languages.find(
    (l) =>
      l.language.toLowerCase().includes('deutsch') ||
      l.language.toLowerCase().includes('german') ||
      l.language.includes('الألمانية')
  );
  const germanLevel = (germanLang?.level || '').toUpperCase();
  const reasons: string[] = [];

  if (germanLevel.includes('C1') || germanLevel.includes('C2')) {
    profileScore += 18;
    reasons.push(`مستوى اللغة الألمانية (${germanLang?.level}) ممتاز`);
  } else if (germanLevel.includes('B2')) {
    profileScore += 14;
    reasons.push('مستوى اللغة الألمانية B2 مناسب لمعظم برامج التدريب');
  } else if (germanLevel.includes('B1')) {
    profileScore += 8;
  }

  if (certificates?.high_school) {
    profileScore += 4;
  }
  if (certificates?.german_cert) {
    profileScore += 4;
  }

  // City match bonus (up to 8 pts)
  const candidateCity = extractCityName(profile.postalCity);
  const oppCity = extractCityName(opportunity.location);
  if (candidateCity && oppCity && (oppCity.includes(candidateCity) || candidateCity.includes(oppCity))) {
    profileScore += 8;
    reasons.push(`الموقع مطابق لمدينتك (${opportunity.location})`);
  }

  // Saved Applications Similarity Boost (determines closest tailored saved app!)
  let bestApp: SavedApplication | null = null;
  let bestAppScore = 0;

  for (const app of savedApplications) {
    const appText = [
      app.packageData.jobAnalysis.roleTitle,
      app.packageData.jobAnalysis.companyName,
      app.packageData.tailoredCv.headline,
      app.packageData.jobAnalysis.hardSkills.join(' '),
      app.jobDescription,
    ].join(' ');
    const appKeywords = extractKeywords(appText);

    const titleOpp = extractKeywords(`${opportunity.title} ${opportunity.occupation}`);
    const titleApp = extractKeywords(
      `${app.packageData.jobAnalysis.roleTitle} ${app.packageData.tailoredCv.headline}`
    );

    const titleOverlap = Math.min(1, overlapRatio(titleOpp, titleApp));
    const fullOverlap = Math.min(1, overlapRatio(oppKeywords, appKeywords));

    const strongCount = app.packageData.jobAnalysis.requirementMatches.filter(
      (m) => m.strength === 'strong'
    ).length;
    const totalCount = Math.max(1, app.packageData.jobAnalysis.requirementMatches.length);
    const appSuccessRatio = strongCount / totalCount;

    const appSimilarity = Math.round(
      titleOverlap * 55 + fullOverlap * 30 + appSuccessRatio * 15
    );

    if (appSimilarity > bestAppScore) {
      bestAppScore = appSimilarity;
      bestApp = app;
    }
  }

  let totalScore = profileScore;
  if (bestApp && bestAppScore >= 35) {
    totalScore = Math.min(
      98,
      Math.max(profileScore, Math.round(profileScore * 0.55 + bestAppScore * 0.62))
    );
    reasons.unshift(
      `قريب من طلبك المحفوظ: ${bestApp.packageData.jobAnalysis.roleTitle} (${bestApp.packageData.jobAnalysis.companyName || 'طلب محفوظ'})`
    );
  } else {
    totalScore = Math.min(95, Math.max(25, profileScore + 15));
  }

  const finalScore = Math.max(20, Math.min(98, totalScore));
  const matchedAppLabel =
    bestApp && bestAppScore >= 35
      ? `${bestApp.packageData.jobAnalysis.roleTitle}${
          bestApp.packageData.jobAnalysis.companyName
            ? ` — ${bestApp.packageData.jobAnalysis.companyName}`
            : ''
        }`
      : null;

  return {
    score: finalScore,
    isHighMatch: finalScore >= 70,
    matchedAppId: bestApp && bestAppScore >= 35 ? bestApp.id : null,
    matchedAppLabel,
    matchedAppScore: bestAppScore,
    reasons: reasons.slice(0, 3),
  };
}
