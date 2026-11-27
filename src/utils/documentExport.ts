import type { CandidateProfile, TailoredCoverLetter, TailoredCv } from '../types/ausbildung';

export function formatCvAsText(cv: TailoredCv, profile: CandidateProfile): string {
  const lines: string[] = [];
  lines.push(`LEBENSLAUF`);
  lines.push(`${profile.fullName}`);
  lines.push(`${cv.headline}`);
  lines.push('');
  lines.push(`PERSÖNLICHE DATEN`);
  if (profile.streetAddress || profile.postalCity) {
    lines.push(`Adresse: ${[profile.streetAddress, profile.postalCity].filter(Boolean).join(', ')}`);
  }
  if (profile.phone) lines.push(`Telefon: ${profile.phone}`);
  if (profile.email) lines.push(`E-Mail: ${profile.email}`);
  if (profile.birthInfo) lines.push(`Geburtsdaten: ${profile.birthInfo}`);
  if (profile.nationality) lines.push(`Staatsangehörigkeit: ${profile.nationality}`);
  if (profile.linkedInOrPortfolio) lines.push(`Web / Portfolio: ${profile.linkedInOrPortfolio}`);
  lines.push('');

  if (cv.profileStatement) {
    lines.push(`KURZPROFIL`);
    lines.push(cv.profileStatement);
    lines.push('');
  }

  if (cv.experience.length > 0) {
    lines.push(`PRAXISERFAHRUNG & PRAKTIKA`);
    for (const exp of cv.experience) {
      lines.push(`${exp.period}  |  ${exp.role} — ${exp.organization}${exp.location ? ` (${exp.location})` : ''}`);
      for (const bullet of exp.bullets) {
        lines.push(`  • ${bullet}`);
      }
    }
    lines.push('');
  }

  if (cv.education.length > 0) {
    lines.push(`SCHULBILDUNG`);
    for (const edu of cv.education) {
      lines.push(`${edu.period}  |  ${edu.degree} — ${edu.institution}${edu.location ? ` (${edu.location})` : ''}`);
      if (edu.details) lines.push(`  ${edu.details}`);
    }
    lines.push('');
  }

  if (cv.skills.length > 0) {
    lines.push(`KENNTNISSE & KOMPETENZEN`);
    for (const group of cv.skills) {
      lines.push(`${group.category}: ${group.items.join(', ')}`);
    }
    lines.push('');
  }

  if (cv.languages.length > 0) {
    lines.push(`SPRACHKENNTNISSE`);
    for (const lang of cv.languages) {
      lines.push(`${lang.language}: ${lang.level}`);
    }
    lines.push('');
  }

  if (cv.interests) {
    lines.push(`INTERESSEN`);
    lines.push(cv.interests);
  }

  return lines.join('\n');
}

export function formatCoverLetterAsText(letter: TailoredCoverLetter): string {
  const lines: string[] = [];
  if (letter.senderBlock) {
    lines.push(letter.senderBlock);
    lines.push('');
  }
  if (letter.recipientBlock) {
    lines.push(letter.recipientBlock);
    lines.push('');
  }
  if (letter.datePlaceLine) {
    lines.push(letter.datePlaceLine);
    lines.push('');
  }
  if (letter.subjectLine) {
    lines.push(letter.subjectLine);
    lines.push('');
  }
  if (letter.salutation) {
    lines.push(letter.salutation);
    lines.push('');
  }
  for (const p of letter.paragraphs) {
    lines.push(p);
    lines.push('');
  }
  if (letter.closing) {
    lines.push(letter.closing);
    lines.push('');
  }
  if (letter.signatureName) {
    lines.push(letter.signatureName);
  }
  return lines.join('\n');
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function countCoverLetterWords(letter: TailoredCoverLetter): number {
  const combined = [
    letter.subjectLine,
    letter.salutation,
    ...letter.paragraphs,
    letter.closing,
  ]
    .join(' ')
    .trim();
  if (!combined) return 0;
  return combined.split(/\s+/).length;
}
